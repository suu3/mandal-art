import { validateGoals, type Goal } from "../domain/goals";
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export type LocalBoard = { goals: Goal[]; revision: number; dirty: boolean };
export const storageKey = (owner: string | null) =>
  `mandalart:v3:${owner === null ? "guest" : `user:${owner}`}`;
export function readLocal(
  storage: StorageLike,
  owner: string | null,
): { board: LocalBoard | null; error?: string; raw?: string; legacy?: string } {
  let raw: string | null = null;
  try {
    const legacy =
      owner === null
        ? (storage.getItem("madalart-next-goals") ?? undefined)
        : undefined;
    raw = storage.getItem(storageKey(owner));
    if (!raw) return { board: null, legacy };
    const data = JSON.parse(raw);
    if (
      !Number.isSafeInteger(data.revision) ||
      data.revision < 0 ||
      typeof data.dirty !== "boolean"
    )
      throw new Error("invalid cache");
    return {
      board: {
        goals: validateGoals(data.goals),
        revision: data.revision,
        dirty: data.dirty,
      },
      legacy,
    };
  } catch {
    return {
      board: null,
      error:
        "기기 저장 데이터를 읽지 못했습니다. 원본 백업을 먼저 내려받아주세요.",
      raw: raw ?? undefined,
    };
  }
}
export function writeLocal(
  storage: StorageLike,
  owner: string | null,
  goals: Goal[],
  revision: number,
  dirty: boolean,
) {
  try {
    storage.setItem(
      storageKey(owner),
      JSON.stringify({ goals, revision, dirty }),
    );
    return true;
  } catch {
    return false;
  }
}
