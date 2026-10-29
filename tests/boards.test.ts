import { afterAll, beforeAll, expect, it } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import app from "../server/index";
import type { Env } from "../server/auth";
import { newRoot } from "../src/entities/board/model/goals";

let mf: Miniflare;
let env: Env;
const origin = "http://localhost:5173";
const secret = "test-secret-that-is-long-enough-for-auth-12345";
function request(
  path: string,
  method = "GET",
  body?: unknown,
  owner = "alice",
) {
  const token = `${owner}-token`;
  const signed = encodeURIComponent(
    `${token}.${createHmac("sha256", secret).update(token).digest("base64")}`,
  );
  return app.fetch(
    new Request(origin + path, {
      method,
      headers: {
        cookie: `better-auth.session_token=${signed}`,
        origin,
        "content-type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    env,
  );
}
beforeAll(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: 'export default {fetch(){return new Response("ok")}}',
      compatibilityDate: "2026-10-01",
      d1Databases: ["DB"],
    }),
  );
  const db = await mf.getD1Database("DB");
  await db.exec(
    readFileSync("migrations/0001_initial.sql", "utf8").replace(/\n/g, " "),
  );
  for (const id of ["alice", "bob", "quota", "race", "burst", "mixed"]) {
    await db
      .prepare(
        "INSERT INTO user(id,name,email,email_verified,created_at,updated_at) VALUES(?,?,?,1,?,?)",
      )
      .bind(id, id, `${id}@example.com`, Date.now(), Date.now())
      .run();
    await db
      .prepare(
        "INSERT INTO session(id,token,user_id,expires_at,created_at,updated_at) VALUES(?,?,?,?,?,?)",
      )
      .bind(
        id,
        `${id}-token`,
        id,
        Date.now() + 86400000,
        Date.now(),
        Date.now(),
      )
      .run();
  }
  await db
    .prepare("INSERT INTO board(owner_id,revision,snapshot) VALUES(?,?,?)")
    .bind("alice", 7, JSON.stringify([{ ...newRoot(), title: "기존 보드" }]))
    .run();
  await db.exec(
    readFileSync("migrations/0002_multiple_boards.sql", "utf8").replace(
      /\n/g,
      " ",
    ),
  );
  env = {
    DB: db as unknown as D1Database,
    BETTER_AUTH_URL: origin,
    BETTER_AUTH_SECRET: secret,
    GITHUB_CLIENT_ID: "test",
    GITHUB_CLIENT_SECRET: "test",
  };
});
afterAll(async () => {
  await mf?.dispose();
});

it("preserves the original board and revision through migration", async () => {
  const response = await request("/api/boards");
  expect(response.status).toBe(200);
  const { boards } = (await response.json()) as any;
  expect(boards).toHaveLength(1);
  expect(boards[0]).toMatchObject({
    id: "legacy-alice",
    title: "기존 보드",
    revision: 7,
  });
  const detail = (await (
    await request("/api/boards/legacy-alice")
  ).json()) as any;
  expect(detail.goals[0].title).toBe("기존 보드");
});
it("creates independent boards and enforces ownership on every operation", async () => {
  const created = await request("/api/boards", "POST", { title: "새 보드" });
  expect(created.status).toBe(201);
  const board = (await created.json()) as any;
  expect(board.revision).toBe(0);
  expect(board.goals[0].title).toBe("새 보드");
  expect(
    (await request(`/api/boards/${board.id}`, "GET", undefined, "bob")).status,
  ).toBe(404);
  expect(
    (
      await request(
        `/api/boards/${board.id}`,
        "PUT",
        { expectedRevision: 0, goals: [newRoot()] },
        "bob",
      )
    ).status,
  ).toBe(404);
  expect(
    (
      await request(
        `/api/boards/${board.id}`,
        "DELETE",
        { expectedRevision: 0 },
        "bob",
      )
    ).status,
  ).toBe(404);
  expect((await request("/api/boards", "POST", { title: "" })).status).toBe(
    400,
  );
  const updated = await request(`/api/boards/${board.id}`, "PUT", {
    expectedRevision: 0,
    goals: [{ ...newRoot(), title: "수정됨" }],
  });
  expect(updated.status).toBe(200);
  expect(
    (
      await request(`/api/boards/${board.id}`, "DELETE", {
        expectedRevision: 0,
      })
    ).status,
  ).toBe(409);
  expect(
    (
      await request(`/api/boards/${board.id}`, "DELETE", {
        expectedRevision: 1,
      })
    ).status,
  ).toBe(200);
  expect((await request(`/api/boards/${board.id}`)).status).toBe(404);
  const { boards } = (await (await request("/api/boards")).json()) as any;
  expect(boards.map((b: any) => b.id)).not.toContain(board.id);
});

it("preserves edits made by the old worker during the deployment transition", async () => {
  await env.DB.prepare(
    "UPDATE board SET snapshot=?,revision=8 WHERE owner_id=?",
  )
    .bind(JSON.stringify([{ ...newRoot(), title: "전환 중 수정" }]), "alice")
    .run();
  const detail = (await (
    await request("/api/boards/legacy-alice")
  ).json()) as any;
  expect(detail.goals[0].title).toBe("전환 중 수정");
  expect(detail.revision).toBe(8);
});

// These tests exercise the real D1 statement: a preflight-only count check
// would let concurrent requests exceed the account quota.
async function seedBoards(owner: string, count: number) {
  const now = new Date(Date.now() - 120_000).toISOString();
  await env.DB.batch(
    Array.from({ length: count }, (_, i) =>
      env.DB.prepare(
        "INSERT INTO boards(id,owner_id,title,revision,snapshot,created_at,updated_at) VALUES(?,?,?,0,?,?,?)",
      ).bind(
        `${owner}-${i}`,
        owner,
        "기존 보드",
        JSON.stringify([newRoot()]),
        now,
        now,
      ),
    ),
  );
}
it("blocks creation at the active-board quota and frees a slot after deletion", async () => {
  await seedBoards("quota", 50);
  expect(
    (await request("/api/boards", "POST", { title: "초과" }, "quota")).status,
  ).toBe(409);
  expect(
    (
      await request(
        "/api/boards/quota-0",
        "DELETE",
        { expectedRevision: 0 },
        "quota",
      )
    ).status,
  ).toBe(200);
  expect(
    (await request("/api/boards", "POST", { title: "빈 자리" }, "quota"))
      .status,
  ).toBe(201);
  // The compatibility API must not create an extra board beyond the cap.
  expect((await request("/api/board", "GET", undefined, "quota")).status).toBe(
    409,
  );
  // A full account must not stop a different owner from creating a board.
  expect(
    (await request("/api/boards", "POST", { title: "다른 계정" }, "bob"))
      .status,
  ).toBe(201);
});
it("allows only one concurrent creation when a single quota slot remains", async () => {
  await seedBoards("race", 49);
  const responses = await Promise.all([
    request("/api/boards", "POST", { title: "동시 A" }, "race"),
    request("/api/boards", "POST", { title: "동시 B" }, "race"),
  ]);
  expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
  const row = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM boards WHERE owner_id=? AND deleted_at IS NULL",
  )
    .bind("race")
    .first<{ count: number }>();
  expect(row?.count).toBe(50);
});
it("limits concurrent bursts, counts deleted creations, and allows creation after the window", async () => {
  const responses = await Promise.all(
    Array.from({ length: 6 }, (_, i) =>
      request("/api/boards", "POST", { title: `연속 ${i}` }, "burst"),
    ),
  );
  expect(responses.map((r) => r.status).sort()).toEqual([
    201, 201, 201, 201, 201, 429,
  ]);
  const limited = responses.find((r) => r.status === 429)!;
  expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
  const created = (await responses.find((r) => r.status === 201)!.json()) as {
    id: string;
  };
  expect(
    (
      await request(
        `/api/boards/${created.id}`,
        "DELETE",
        { expectedRevision: 0 },
        "burst",
      )
    ).status,
  ).toBe(200);
  expect(
    (await request("/api/boards", "POST", { title: "삭제 우회" }, "burst"))
      .status,
  ).toBe(429);
  expect((await request("/api/board", "GET", undefined, "burst")).status).toBe(
    429,
  );
  await env.DB.prepare("UPDATE boards SET created_at=? WHERE owner_id=?")
    .bind(new Date(Date.now() - 120_000).toISOString(), "burst")
    .run();
  expect(
    (await request("/api/boards", "POST", { title: "다시 생성" }, "burst"))
      .status,
  ).toBe(201);
});

it("shares the atomic burst limit between current and legacy creation paths", async () => {
  const responses = await Promise.all([
    request("/api/board", "GET", undefined, "mixed"),
    ...Array.from({ length: 5 }, (_, i) =>
      request("/api/boards", "POST", { title: `혼합 ${i}` }, "mixed"),
    ),
  ]);
  expect(
    responses.filter((r) => r.status === 200 || r.status === 201),
  ).toHaveLength(5);
  expect(responses.filter((r) => r.status === 429)).toHaveLength(1);
  const row = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM boards WHERE owner_id=?",
  )
    .bind("mixed")
    .first<{ count: number }>();
  expect(row?.count).toBe(5);
});
