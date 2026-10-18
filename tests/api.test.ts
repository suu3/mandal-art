import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import app from "../server/index";
import { newRoot } from "../src/domain/goals";
import type { Env } from "../server/auth";

let mf: Miniflare;
let env: Env;
const secret = "test-secret-that-is-long-enough-for-auth-12345";
const origin = "http://localhost:5173";
function cookie(token: string) {
  const signature = createHmac("sha256", secret).update(token).digest("base64");
  return `better-auth.session_token=${encodeURIComponent(`${token}.${signature}`)}`;
}
function request(
  path: string,
  method = "GET",
  data?: unknown,
  user = "alice",
  extra: Record<string, string> = {},
) {
  return app.fetch(
    new Request(`${origin}${path}`, {
      method,
      headers: {
        ...(user ? { cookie: cookie(`${user}-token`) } : {}),
        ...(data !== undefined
          ? { "content-type": "application/json", origin }
          : {}),
        ...extra,
      },
      body: data === undefined ? undefined : JSON.stringify(data),
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
    readFileSync(
      new URL("../migrations/0001_initial.sql", import.meta.url),
      "utf8",
    ).replace(/\n/g, " "),
  );
  for (const id of ["alice", "bob"]) {
    await db
      .prepare(
        "INSERT INTO user (id,name,email,email_verified,created_at,updated_at) VALUES (?,?,?,1,?,?)",
      )
      .bind(id, id, `${id}@example.com`, Date.now(), Date.now())
      .run();
    await db
      .prepare(
        "INSERT INTO session (id,token,user_id,expires_at,created_at,updated_at) VALUES (?,?,?,?,?,?)",
      )
      .bind(
        `${id}-session`,
        `${id}-token`,
        id,
        Date.now() + 86400000,
        Date.now(),
        Date.now(),
      )
      .run();
  }
  env = {
    DB: db as unknown as D1Database,
    BETTER_AUTH_SECRET: secret,
    BETTER_AUTH_URL: origin,
    GITHUB_CLIENT_ID: "test-id",
    GITHUB_CLIENT_SECRET: "test-client-secret",
  };
});
afterAll(async () => {
  await mf?.dispose();
});
describe("real D1 board API and signed sessions", () => {
  it("rejects anonymous callers and marks every API response no-store", async () => {
    const response = await request("/api/board", "GET", undefined, "");
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("creates an initial board through a real better-auth session", async () => {
    const response = await request("/api/board");
    expect(response.status).toBe(200);
    const board = (await response.json()) as any;
    expect(board.revision).toBe(0);
    expect(board.goals[0].id).toBe("root");
  });
  it("atomically replaces goals and isolates owners", async () => {
    const a = { ...newRoot(), title: "Alice private" };
    let response = await request("/api/board", "PUT", {
      expectedRevision: 0,
      goals: [a, { ...a, id: "child", parentId: "root" }],
    });
    expect(response.status).toBe(200);
    response = await request("/api/board", "PUT", {
      expectedRevision: 1,
      goals: [a],
    });
    expect(response.status).toBe(200);
    expect(
      ((await (await request("/api/board")).json()) as any).goals.map(
        (g: any) => g.id,
      ),
    ).toEqual(["root"]);
    expect(
      (
        (await (
          await request("/api/board", "GET", undefined, "bob")
        ).json()) as any
      ).goals[0].title,
    ).not.toBe("Alice private");
  });
  it("accepts one concurrent revision and rejects the other", async () => {
    const payload = { expectedRevision: 2, goals: [newRoot()] };
    const responses = await Promise.all([
      request("/api/board", "PUT", payload),
      request("/api/board", "PUT", payload),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
  });
  it("rejects bad trees, malformed revisions, oversized payloads and cross-origin writes", async () => {
    expect(
      (await request("/api/board", "PUT", { expectedRevision: 3, goals: [] }))
        .status,
    ).toBe(400);
    expect(
      (
        await request("/api/board", "PUT", {
          expectedRevision: -1,
          goals: [newRoot()],
        })
      ).status,
    ).toBe(400);
    expect(
      (await request("/api/board", "PUT", { padding: "x".repeat(262145) }))
        .status,
    ).toBe(413);
    expect(
      (
        await request(
          "/api/board",
          "PUT",
          { expectedRevision: 3, goals: [newRoot()] },
          "alice",
          { origin: "https://attacker.invalid" },
        )
      ).status,
    ).toBe(403);
  });
  it("returns useful config without exposing secrets", async () => {
    const response = await app.fetch(new Request(`${origin}/api/config`), {
      DB: env.DB,
    } as Env);
    expect(await response.json()).toEqual({ githubLogin: false });
    expect((await request("/api/unknown")).status).toBe(404);
  });
});
