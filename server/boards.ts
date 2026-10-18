import { newRoot, type Goal } from "../src/entities/board/model/goals";
import { getOwnedBoard } from "./board-routes";
// Compatibility endpoint for clients running the previous single-board bundle.
// It writes the migrated record so a stale tab cannot fork the user's data.
export async function readBoard(db: D1Database, owner: string) {
  const id = `legacy-${owner}`,
    now = new Date().toISOString(),
    goals = [newRoot()];
  await db
    .prepare(
      "INSERT OR IGNORE INTO boards(id,owner_id,title,revision,snapshot,created_at,updated_at) VALUES(?,?,?,0,?,?,?)",
    )
    .bind(id, owner, goals[0].title, JSON.stringify(goals), now, now)
    .run();
  const row = await getOwnedBoard(db, owner, id);
  if (!row) throw new Error("This board was deleted. Reload the app.");
  return { revision: row.revision, goals: JSON.parse(row.snapshot) as Goal[] };
}
export async function replaceBoard(
  db: D1Database,
  owner: string,
  expectedRevision: number,
  goals: Goal[],
) {
  await readBoard(db, owner);
  const result = await db
    .prepare(
      "UPDATE boards SET title=?,snapshot=?,revision=revision+1,updated_at=? WHERE id=? AND owner_id=? AND revision=? AND deleted_at IS NULL",
    )
    .bind(
      goals.find((g) => g.id === "root")!.title,
      JSON.stringify(goals),
      new Date().toISOString(),
      `legacy-${owner}`,
      owner,
      expectedRevision,
    )
    .run();
  return result.meta.changes === 1
    ? { revision: expectedRevision + 1, goals }
    : null;
}
