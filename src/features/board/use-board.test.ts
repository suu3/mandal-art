// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useBoard } from "./use-board";
import { newRoot } from "../../domain/goals";
import { readLocal } from "../../data/storage";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});
it("keeps an edit dirty until that exact snapshot is acknowledged by the server", async () => {
  let releaseFirst!: () => void;
  let releaseSecond!: () => void;
  let started = 0;
  const first = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  const second = new Promise<void>((resolve) => {
    releaseSecond = resolve;
  });
  vi.stubGlobal("fetch", async (_url: string, init?: RequestInit) => {
    if (init?.method !== "PUT")
      return Response.json({ revision: 0, goals: [newRoot()] });
    const body = JSON.parse(init.body as string);
    started++;
    await (started === 1 ? first : second);
    return Response.json({
      revision: body.expectedRevision + 1,
      goals: body.goals,
    });
  });
  const { result } = renderHook(() => useBoard("alice", false));
  await waitFor(() => expect(result.current.ready).toBe(true));
  act(() => result.current.persist([{ ...newRoot(), title: "first" }]));
  await waitFor(() => expect(started).toBe(1), { timeout: 2000 });
  act(() => result.current.persist([{ ...newRoot(), title: "second" }]));
  await act(async () => {
    releaseFirst();
    await first;
  });
  expect(result.current.status).toBe("saving");
  expect(readLocal(localStorage, "alice").board?.dirty).toBe(true);
  await act(async () => {
    releaseSecond();
    await second;
  });
  await waitFor(() => expect(result.current.status).toBe("saved"), {
    timeout: 2000,
  });
  expect(readLocal(localStorage, "alice").board).toMatchObject({
    revision: 2,
    dirty: false,
    goals: [{ title: "second" }],
  });
});
