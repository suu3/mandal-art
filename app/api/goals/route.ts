import { inArray, and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { getDb, hasDbConfig } from "@/lib/db";
import { goals } from "@/lib/db/schema";
import type { Goal, GoalSticker } from "@/lib/types";

export const runtime = "nodejs";

async function requireUserId(request: Request) {
  if (!hasDbConfig()) return null;
  const session = await getAuth().api.getSession({ headers: request.headers as Headers });
  return session?.user.id ?? null;
}

function sanitizeStickers(value: unknown): GoalSticker[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      id: typeof item.id === "string" ? item.id : crypto.randomUUID(),
      src: typeof item.src === "string" ? item.src : "",
      name: typeof item.name === "string" ? item.name : "sticker",
      x: typeof item.x === "number" ? item.x : 50,
      y: typeof item.y === "number" ? item.y : 30,
      size: typeof item.size === "number" ? item.size : 28,
      rotation: typeof item.rotation === "number" ? item.rotation : 0
    }))
    .filter((item) => item.src);
}

type OwnedGoal = Goal & { ownerId: string };

function sanitizeGoal(value: unknown, ownerId: string): OwnedGoal | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Partial<Goal>;
  if (typeof raw.id !== "string" || !raw.id) return null;

  const nowIso = new Date().toISOString();
  return {
    id: raw.id,
    ownerId,
    parentId: typeof raw.parentId === "string" ? raw.parentId : null,
    slot: typeof raw.slot === "number" && raw.slot >= 0 && raw.slot <= 7 ? raw.slot : 0,
    title: typeof raw.title === "string" && raw.title.trim() ? raw.title : "새 목표",
    description: typeof raw.description === "string" ? raw.description : "",
    status: raw.status === "doing" || raw.status === "done" ? raw.status : "todo",
    priority: raw.priority === "low" || raw.priority === "high" ? raw.priority : "medium",
    dueDate: typeof raw.dueDate === "string" ? raw.dueDate : null,
    stickers: sanitizeStickers(raw.stickers),
    imageUrl: typeof raw.imageUrl === "string" ? raw.imageUrl : null,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : nowIso,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : nowIso
  };
}

export async function GET(request: Request) {
  const userId = await requireUserId(request);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rows = await getDb().select().from(goals).where(eq(goals.ownerId, userId)).orderBy(goals.slot);
  return NextResponse.json({ goals: rows });
}

export async function PUT(request: Request) {
  const userId = await requireUserId(request);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const payload = (await request.json().catch(() => null)) as { goals?: unknown[] } | null;
  if (!payload || !Array.isArray(payload.goals)) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const nextGoals = payload.goals
    .map((goal) => sanitizeGoal(goal, userId))
    .filter((goal): goal is OwnedGoal => goal !== null);

  if (nextGoals.length) {
    await getDb()
      .insert(goals)
      .values(nextGoals)
      .onConflictDoUpdate({
        target: [goals.ownerId, goals.id],
        set: {
          parentId: sql`excluded.parent_id`,
          slot: sql`excluded.slot`,
          title: sql`excluded.title`,
          description: sql`excluded.description`,
          status: sql`excluded.status`,
          priority: sql`excluded.priority`,
          dueDate: sql`excluded.due_date`,
          stickers: sql`excluded.stickers`,
          imageUrl: sql`excluded.image_url`,
          updatedAt: sql`excluded.updated_at`
        }
      });
  }

  return NextResponse.json({ ok: true, count: nextGoals.length });
}

export async function DELETE(request: Request) {
  const userId = await requireUserId(request);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const payload = (await request.json().catch(() => null)) as { ids?: unknown[] } | null;
  const ids = Array.isArray(payload?.ids) ? payload.ids.filter((id): id is string => typeof id === "string") : [];
  if (!ids.length) return NextResponse.json({ error: "invalid payload" }, { status: 400 });

  await getDb()
    .delete(goals)
    .where(and(eq(goals.ownerId, userId), inArray(goals.id, ids)));

  return NextResponse.json({ ok: true });
}
