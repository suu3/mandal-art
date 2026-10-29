import type { Goal } from "../src/entities/board/model/goals";

export class BoardCreationError extends Error {
  constructor(
    message: string,
    public status: 409 | 429,
  ) {
    super(message);
  }
}

// Use the same atomic guard for both the current and legacy creation APIs.
// Deleted rows still count toward the rolling window, preventing delete/retry
// loops from bypassing the rate limit. Existing boards are never removed.
export async function insertBoardWithinLimits(
  db: D1Database,
  owner: string,
  id: string,
  title: string,
  goals: Goal[],
  now: string,
) {
  const result = await db
    .prepare(
      `INSERT OR IGNORE INTO boards(id,owner_id,title,revision,snapshot,created_at,updated_at)
     SELECT ?,?,?,0,?,?,?
     WHERE (SELECT COUNT(*) FROM boards WHERE owner_id=? AND deleted_at IS NULL) < 50
       AND (SELECT COUNT(*) FROM boards WHERE owner_id=? AND created_at>?) < 5`,
    )
    .bind(
      id,
      owner,
      title,
      JSON.stringify(goals),
      now,
      now,
      owner,
      owner,
      new Date(Date.parse(now) - 60_000).toISOString(),
    )
    .run();
  if (result.meta.changes) return true;
  // Concurrent legacy requests may find the same board already created. A
  // deleted legacy board remains deleted, rather than being recreated.
  if (
    await db
      .prepare("SELECT id FROM boards WHERE id=? AND owner_id=?")
      .bind(id, owner)
      .first()
  )
    return false;
  const active = await db
    .prepare(
      "SELECT COUNT(*) AS count FROM boards WHERE owner_id=? AND deleted_at IS NULL",
    )
    .bind(owner)
    .first<{ count: number }>();
  if (active && active.count >= 50)
    throw new BoardCreationError(
      "보드는 계정당 최대 50개까지 만들 수 있습니다. 기존 보드를 삭제한 뒤 다시 시도해주세요.",
      409,
    );
  throw new BoardCreationError(
    "보드는 1분에 최대 5개까지 만들 수 있습니다. 잠시 후 다시 시도해주세요.",
    429,
  );
}
