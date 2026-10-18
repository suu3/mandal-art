import { z } from "zod";
import { request, ApiError } from "../../../shared/api/client";
import {
  boardSchema,
  boardSummarySchema,
  type Board,
  type Goal,
} from "../model/types";
import { demoGoals, newRoot, validateGoals } from "../model/goals";
import { readLocal, writeLocal, storageKey } from "../lib/storage";
export const LOCAL_BOARD = "local";
export class LocalBoardError extends ApiError {
  constructor(
    message: string,
    public recovery?: string,
  ) {
    super(message, 422);
  }
}
export function recoverLocalBoard() {
  const key = `mandalart:recovery:guest:${Date.now()}`,
    raw = localStorage.getItem(storageKey(null));
  if (raw !== null) localStorage.setItem(key, raw);
  if (!writeLocal(localStorage, null, [newRoot()], 0, false))
    throw new ApiError("기기 저장소를 사용할 수 없습니다.", 507);
  return key;
}
function localBoard(): Board {
  const saved = readLocal(localStorage, null);
  if (saved.error) throw new LocalBoardError(saved.error, saved.raw);
  const goals = saved.board?.goals ?? demoGoals(),
    root = goals.find((g) => g.id === "root")!;
  return {
    id: LOCAL_BOARD,
    title: root.title,
    revision: saved.board?.revision ?? 0,
    goals,
    createdAt: root.createdAt,
    updatedAt: root.updatedAt,
  };
}
export async function getBoard(
  id: string,
  signal?: AbortSignal,
): Promise<Board> {
  if (id === LOCAL_BOARD) return localBoard();
  return request(`/api/boards/${encodeURIComponent(id)}`, boardSchema, {
    signal,
  });
}
export async function getBoards(signal?: AbortSignal) {
  return (
    await request(
      "/api/boards",
      z.object({ boards: z.array(boardSummarySchema) }),
      { signal },
    )
  ).boards;
}
export async function createBoard(title: string) {
  const input = z
    .object({ title: z.string().trim().min(1).max(120) })
    .parse({ title });
  return request("/api/boards", boardSchema, {
    method: "POST",
    body: JSON.stringify(input),
  });
}
export async function saveBoard(
  id: string,
  goals: Goal[],
  expectedRevision: number,
): Promise<Board> {
  const valid = validateGoals(goals);
  if (id === LOCAL_BOARD) {
    const before = localBoard();
    if (before.revision !== expectedRevision)
      throw new ApiError("다른 창에서 수정되었습니다. 다시 불러와주세요.", 409);
    const revision = expectedRevision + 1;
    if (!writeLocal(localStorage, null, valid, revision, false))
      throw new ApiError(
        "기기에 저장하지 못했습니다. 입력 내용을 백업해주세요.",
        507,
      );
    return {
      ...before,
      goals: valid,
      title: valid.find((g) => g.id === "root")!.title,
      revision,
      updatedAt: new Date().toISOString(),
    };
  }
  return request(`/api/boards/${encodeURIComponent(id)}`, boardSchema, {
    method: "PUT",
    body: JSON.stringify({
      expectedRevision: z.number().int().nonnegative().parse(expectedRevision),
      goals: valid,
    }),
  });
}
export function deleteBoard(id: string, expectedRevision: number) {
  return request(
    `/api/boards/${encodeURIComponent(id)}`,
    z.object({ ok: z.literal(true) }),
    { method: "DELETE", body: JSON.stringify({ expectedRevision }) },
  );
}
