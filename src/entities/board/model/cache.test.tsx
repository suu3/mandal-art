// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { newRoot } from "./goals";
import { useMandalartEditor } from "../../../widgets/mandalart-editor/model/useMandalartEditor";
import { useBoardProgress } from "../../../widgets/board-progress/model/useBoardProgress";
import { useBoardGoals } from "../../../widgets/board-goals/model/useBoardGoals";
import { useSaveBoard } from "../../../features/edit-goal/model/useSaveBoard";
import { useToggleGoal } from "../../../features/toggle-goal/model/useToggleGoal";
import { boardKeys, type Board } from "..";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function fixture(): Board {
  const root = newRoot();
  return {
    id: "test-board",
    title: "보드",
    revision: 0,
    createdAt: root.createdAt,
    updatedAt: root.updatedAt,
    goals: [root, { ...root, id: "child", parentId: "root", title: "실천" }],
  };
}
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    client,
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  };
}
it("shares one raw board cache across editor, goals and progress selectors and updates all on save", async () => {
  let gets = 0;
  let release!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  const raw = fixture();
  vi.stubGlobal("fetch", async (_url: string, init?: RequestInit) => {
    if (init?.method === "PUT") {
      await gate;
      const input = JSON.parse(init.body as string);
      return Response.json({ ...raw, revision: 1, goals: input.goals });
    }
    gets++;
    return Response.json(raw);
  });
  const { client, wrapper } = setup();
  const { result } = renderHook(
    () => ({
      editor: useMandalartEditor("test-board"),
      list: useBoardGoals("test-board"),
      progress: useBoardProgress("test-board"),
      save: useSaveBoard("test-board"),
    }),
    { wrapper },
  );
  await waitFor(() => expect(result.current.list.data).toHaveLength(1));
  expect(gets).toBe(1);
  expect(result.current.progress.data).toEqual({
    total: 1,
    done: 0,
    percent: 0,
  });
  const edited = raw.goals.map((g) =>
    g.id === "child" ? { ...g, status: "done" as const } : g,
  );
  let saved!: Promise<unknown>;
  act(() => {
    saved = result.current.save.mutateAsync(edited);
  });
  expect(
    client.getQueryData<Board>(boardKeys.detail("test-board"))?.goals[1].status,
  ).toBe("todo");
  await act(async () => {
    release();
    await saved;
  });
  await waitFor(() => expect(result.current.progress.data?.percent).toBe(100));
  expect(result.current.editor.data?.goals[1].status).toBe("done");
  expect(result.current.list.data?.[0].status).toBe("done");
  expect(client.getQueryData(boardKeys.detail("test-board"))).toMatchObject({
    id: "test-board",
    revision: 1,
    goals: expect.any(Array),
  });
});
it("rolls back optimistic completion for every selector when save fails", async () => {
  const raw = fixture();
  let reject!: () => void;
  const gate = new Promise<void>((_r, j) => {
    reject = () => j(new Error("offline"));
  });
  vi.stubGlobal("fetch", async (_url: string, init?: RequestInit) => {
    if (init?.method === "PUT") await gate;
    return Response.json(raw);
  });
  const { client, wrapper } = setup();
  const { result } = renderHook(
    () => ({
      progress: useBoardProgress("test-board"),
      toggle: useToggleGoal("test-board"),
    }),
    { wrapper },
  );
  await waitFor(() => expect(result.current.progress.data?.percent).toBe(0));
  let pending!: Promise<unknown>;
  act(() => {
    pending = result.current.toggle
      .mutateAsync({ goalId: "child", status: "done" })
      .catch(() => {});
  });
  await waitFor(() => expect(result.current.progress.data?.percent).toBe(100));
  await act(async () => {
    reject();
    await pending;
  });
  await waitFor(() => expect(result.current.progress.data?.percent).toBe(0));
  expect(
    client.getQueryData<Board>(boardKeys.detail("test-board"))?.goals[1].status,
  ).toBe("todo");
});
