import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import { createAuth, authReady, type Env } from "./auth";
import { BoardCreationError, insertBoardWithinLimits } from "./board-creation";
import {
  MAX_BYTES,
  newRoot,
  validateGoals,
} from "../src/entities/board/model/goals";

type Row = {
  id: string;
  title: string;
  revision: number;
  snapshot: string;
  createdAt: string;
  updatedAt: string;
};
const columns =
  "id,title,revision,snapshot,created_at AS createdAt,updated_at AS updatedAt";
export const getOwnedBoard = (db: D1Database, owner: string, id: string) =>
  db
    .prepare(
      `SELECT ${columns} FROM boards WHERE id=? AND owner_id=? AND deleted_at IS NULL`,
    )
    .bind(id, owner)
    .first<Row>();
export const serializeBoard = (row: Row) => ({
  id: row.id,
  title: row.title,
  revision: row.revision,
  goals: JSON.parse(row.snapshot),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});
const routes = new Hono<{ Bindings: Env; Variables: { owner: string } }>();
routes.use(
  "*",
  bodyLimit({
    maxSize: MAX_BYTES,
    onError: (c) => c.json({ error: "요청은 256KiB 이하여야 합니다." }, 413),
  }),
);
routes.use("*", async (c, next) => {
  if (!authReady(c.env)) return c.json({ error: "로그인이 필요합니다." }, 401);
  const session = await createAuth(c.env).api.getSession({
    headers: c.req.raw.headers,
  });
  if (!session) return c.json({ error: "로그인이 필요합니다." }, 401);
  c.set("owner", session.user.id);
  await next();
});
routes.get("/", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT id,title,revision,created_at AS createdAt,updated_at AS updatedAt FROM boards WHERE owner_id=? AND deleted_at IS NULL ORDER BY updated_at DESC,id",
  )
    .bind(c.get("owner"))
    .all();
  return c.json({ boards: results });
});
routes.post("/", async (c) => {
  const parsed = z
    .object({ title: z.string().trim().min(1).max(120) })
    .safeParse(await c.req.json().catch(() => null));
  if (!parsed.success)
    return c.json({ error: "보드 이름을 1~120자로 입력해주세요." }, 400);
  const now = new Date().toISOString(),
    id = crypto.randomUUID();
  const goals = [{ ...newRoot(), title: parsed.data.title }];
  const inserted = await insertBoardWithinLimits(
    c.env.DB,
    c.get("owner"),
    id,
    parsed.data.title,
    goals,
    now,
  );
  if (!inserted)
    throw new BoardCreationError(
      "보드를 만들지 못했습니다. 다시 시도해주세요.",
      409,
    );
  return c.json(
    {
      id,
      title: parsed.data.title,
      goals,
      revision: 0,
      createdAt: now,
      updatedAt: now,
    },
    201,
  );
});
routes.get("/:id", async (c) => {
  const row = await getOwnedBoard(c.env.DB, c.get("owner"), c.req.param("id"));
  return row
    ? c.json(serializeBoard(row))
    : c.json({ error: "보드를 찾을 수 없습니다." }, 404);
});
routes.put("/:id", async (c) => {
  const id = c.req.param("id"),
    owner = c.get("owner");
  const before = await getOwnedBoard(c.env.DB, owner, id);
  if (!before) return c.json({ error: "보드를 찾을 수 없습니다." }, 404);
  const parsed = z
    .object({
      expectedRevision: z
        .number()
        .int()
        .nonnegative()
        .max(Number.MAX_SAFE_INTEGER - 1),
      goals: z.unknown(),
    })
    .safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "잘못된 보드 요청입니다." }, 400);
  let goals;
  try {
    goals = validateGoals(parsed.data.goals);
  } catch {
    return c.json({ error: "목표 형식을 확인해주세요." }, 400);
  }
  const title = goals.find((g) => g.id === "root")!.title,
    now = new Date().toISOString();
  const result = await c.env.DB.prepare(
    "UPDATE boards SET title=?,snapshot=?,revision=revision+1,updated_at=? WHERE id=? AND owner_id=? AND revision=? AND deleted_at IS NULL",
  )
    .bind(
      title,
      JSON.stringify(goals),
      now,
      id,
      owner,
      parsed.data.expectedRevision,
    )
    .run();
  if (!result.meta.changes)
    return c.json(
      { error: "다른 창에서 수정되었습니다. 다시 불러온 뒤 저장해주세요." },
      409,
    );
  return c.json({
    ...serializeBoard(before),
    title,
    goals,
    revision: parsed.data.expectedRevision + 1,
    updatedAt: now,
  });
});
routes.delete("/:id", async (c) => {
  const id = c.req.param("id"),
    owner = c.get("owner");
  if (!(await getOwnedBoard(c.env.DB, owner, id)))
    return c.json({ error: "보드를 찾을 수 없습니다." }, 404);
  const parsed = z
    .object({ expectedRevision: z.number().int().nonnegative() })
    .safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "보드 버전이 필요합니다." }, 400);
  const result = await c.env.DB.prepare(
    "UPDATE boards SET deleted_at=?,revision=revision+1 WHERE id=? AND owner_id=? AND revision=? AND deleted_at IS NULL",
  )
    .bind(new Date().toISOString(), id, owner, parsed.data.expectedRevision)
    .run();
  return result.meta.changes
    ? c.json({ ok: true })
    : c.json({ error: "보드가 변경되었습니다. 다시 불러와주세요." }, 409);
});
export default routes;
