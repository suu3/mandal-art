import { z } from "zod";

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const date = new Date(`${v}T00:00:00Z`);
    return (
      Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === v
    );
  }, "올바른 날짜를 입력해주세요.");
const goalSchema = z.object({
  id: z.string().min(1).max(128),
  ownerId: z
    .unknown()
    .optional()
    .transform(() => null),
  parentId: z.string().min(1).max(128).nullable(),
  slot: z.number().int().min(0).max(7),
  title: z.string().trim().min(1).max(120),
  description: z.string().max(4000).default(""),
  status: z.enum(["todo", "doing", "done"]),
  priority: z.enum(["low", "medium", "high"]),
  dueDate: dateOnly.nullable().default(null),
  imageUrl: z
    .null({
      error:
        "이미지가 포함된 백업입니다. 원본을 보관하고 이미지를 별도로 이전해주세요.",
    })
    .optional()
    .transform(() => null),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Goal = z.output<typeof goalSchema>;
export const MAX_BYTES = 256 * 1024;

export function newRoot(): Goal {
  const timestamp = new Date().toISOString();
  return {
    id: "root",
    ownerId: null,
    parentId: null,
    slot: 0,
    title: "내가 만들어갈 한 해",
    description: "큰 목표를 작은 실천으로 바꿔보세요.",
    status: "todo",
    priority: "medium",
    dueDate: null,
    imageUrl: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function validateGoals(value: unknown): Goal[] {
  const goals = z.array(goalSchema).min(1).max(1000).parse(value);
  if (new TextEncoder().encode(JSON.stringify(goals)).length > MAX_BYTES - 1024)
    throw new Error(
      "보드 크기가 너무 큽니다. JSON으로 백업한 뒤 목표를 줄여주세요.",
    );
  const nodes = new Map(goals.map((g) => [g.id, g]));
  if (nodes.size !== goals.length)
    throw new Error("중복된 목표 ID가 있습니다.");
  if (
    goals.filter((g) => g.parentId === null).length !== 1 ||
    nodes.get("root")?.parentId !== null
  )
    throw new Error("root 목표가 정확히 하나 필요합니다.");
  const slots = new Set<string>();
  for (const goal of goals) {
    if (goal.parentId === null) continue;
    if (!nodes.has(goal.parentId))
      throw new Error("상위 목표를 찾을 수 없습니다.");
    const key = JSON.stringify([goal.parentId, goal.slot]);
    if (slots.has(key)) throw new Error("같은 위치에 목표가 두 개 있습니다.");
    slots.add(key);
    const visited = new Set([goal.id]);
    let cursor: Goal = goal;
    while (cursor.parentId !== null) {
      if (visited.has(cursor.parentId))
        throw new Error("목표가 순환하고 있습니다.");
      visited.add(cursor.parentId);
      const parent = nodes.get(cursor.parentId);
      if (!parent) throw new Error("상위 목표를 찾을 수 없습니다.");
      cursor = parent;
    }
  }
  return goals;
}

export const childrenOf = (goals: Goal[], id: string) =>
  goals.filter((g) => g.parentId === id).sort((a, b) => a.slot - b.slot);
export function pathOf(goals: Goal[], id: string): Goal[] {
  const path: Goal[] = [];
  const visited = new Set<string>();
  let cursor = goals.find((g) => g.id === id);
  while (cursor && !visited.has(cursor.id)) {
    path.unshift(cursor);
    visited.add(cursor.id);
    cursor = goals.find((g) => g.id === cursor!.parentId);
  }
  return path;
}
export function progressOf(goals: Goal[], id: string) {
  const children = childrenOf(goals, id);
  return children.length
    ? Math.round(
        (100 * children.filter((g) => g.status === "done").length) /
          children.length,
      )
    : goals.find((g) => g.id === id)?.status === "done"
      ? 100
      : 0;
}
export function parseBackup(text: string): Goal[] {
  if (new TextEncoder().encode(text).length > MAX_BYTES)
    throw new Error("백업 파일은 256KiB 이하여야 합니다.");
  const value: unknown = JSON.parse(text);
  return validateGoals(
    Array.isArray(value) ? value : (value as { goals?: unknown } | null)?.goals,
  );
}
export function demoGoals(): Goal[] {
  const root = {
    ...newRoot(),
    title: "나답게, 꾸준히 성장하기",
    description: "내가 원하는 삶에 가까워지는 여덟 가지 작은 실천.",
  };
  const titles = [
    "몸과 마음 돌보기",
    "깊이 있게 배우기",
    "좋은 관계 가꾸기",
    "나만의 작업 쌓기",
    "일상의 여유 찾기",
    "단단한 경제 습관",
    "새로운 경험 하기",
    "나를 돌아보기",
  ];
  const descriptions = [
    "충분히 자고, 가볍게 움직이는 하루",
    "호기심을 놓지 않고 조금씩 깊어지기",
    "소중한 사람에게 먼저 안부 전하기",
    "작더라도 끝까지 만들어 세상에 내놓기",
    "바쁜 하루에도 나를 위한 시간 만들기",
    "오늘의 선택으로 내일의 여유 준비하기",
    "익숙한 길에서 한 걸음 벗어나보기",
    "지나온 날을 기록하고 다음을 그리기",
  ];
  const goals: Goal[] = [
    root,
    ...titles.map((title, slot): Goal => ({
      ...newRoot(),
      id: `area-${slot}`,
      parentId: "root",
      slot,
      title,
      description: descriptions[slot],
      status: slot === 2 || slot === 6 ? "done" : slot === 0 ? "doing" : "todo",
    })),
  ];
  goals.push(
    ...[
      "매일 20분 산책하기",
      "잠들기 전 화면 내려놓기",
      "주 2회 가볍게 운동하기",
    ].map((title, slot): Goal => ({
      ...newRoot(),
      id: `habit-${slot}`,
      parentId: "area-0",
      slot,
      title,
      description: "",
      status: slot === 0 ? "done" : "todo",
    })),
  );
  return goals;
}
