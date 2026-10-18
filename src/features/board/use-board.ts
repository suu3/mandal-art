import { useEffect, useRef, useState } from "react";
import {
  demoGoals,
  newRoot,
  validateGoals,
  type Goal,
} from "../../domain/goals";
import { readLocal, writeLocal } from "../../data/storage";
import { getBoard, putBoard, SaveQueue } from "../../data/sync";

type State = {
  owner: string | null | undefined;
  goals: Goal[];
  ready: boolean;
  status: string;
  error?: string;
  recovery?: string;
  legacy?: string;
};
export function useBoard(owner: string | null, pending: boolean) {
  const [state, setState] = useState<State>({
    owner: undefined,
    goals: demoGoals(),
    ready: false,
    status: "loading",
  });
  const [reload, setReload] = useState(0);
  const queue = useRef<SaveQueue | null>(null);
  const latest = useRef<Goal[]>([]);
  const revision = useRef(0);
  useEffect(() => {
    if (pending) return;
    let active = true;
    const controller = new AbortController();
    queue.current?.dispose();
    queue.current = null;
    let storage: Storage;
    try {
      storage = window.localStorage;
    } catch {
      setState({
        owner,
        goals: [newRoot()],
        ready: true,
        status: "local-error",
        error: "기기 저장소를 사용할 수 없습니다. 내보내기로 백업해주세요.",
      });
      return;
    }
    const local = readLocal(storage, owner);
    revision.current = local.board?.revision ?? 0;
    latest.current = local.board?.goals ?? (owner ? [newRoot()] : demoGoals());
    if (local.error) {
      setState({
        owner,
        goals: latest.current,
        ready: false,
        status: "recovery",
        error: local.error,
        recovery: local.raw,
      });
      return;
    }
    setState({
      owner,
      goals: latest.current,
      ready: !owner,
      status: owner ? "loading" : "local",
      legacy: local.legacy,
    });
    if (!owner) return;
    async function load() {
      try {
        const server = await getBoard(controller.signal);
        server.goals = validateGoals(server.goals);
        if (!active) return;
        const conflict = Boolean(
          local.board?.dirty && local.board.revision !== server.revision,
        );
        const goals = local.board?.dirty ? local.board.goals : server.goals;
        latest.current = goals;
        revision.current = conflict ? local.board!.revision : server.revision;
        setState({
          owner,
          goals,
          ready: true,
          status: conflict
            ? "conflict"
            : local.board?.dirty
              ? "error"
              : "saved",
        });
        if (conflict) return;
        const saver = new SaveQueue(
          server.revision,
          putBoard,
          (status, board) => {
            if (!active) return;
            if (board) revision.current = board.revision;
            const stored = writeLocal(
              storage,
              owner,
              latest.current,
              revision.current,
              status !== "saved",
            );
            setState((s) => ({
              ...s,
              status: stored ? status : "local-error",
              error: stored
                ? undefined
                : "기기 백업을 저장하지 못했습니다. JSON 내보내기로 백업해주세요.",
            }));
          },
        );
        queue.current = saver;
        if (!local.board?.dirty)
          writeLocal(storage, owner, goals, server.revision, false);
      } catch (error) {
        if (!active || controller.signal.aborted) return;
        setState({
          owner,
          goals: latest.current,
          ready: true,
          status: "error",
          error: error instanceof Error ? error.message : "불러오기 실패",
        });
      }
    }
    void load();
    return () => {
      active = false;
      controller.abort();
      queue.current?.dispose();
      queue.current = null;
    };
  }, [owner, pending, reload]);

  function persist(input: Goal[]) {
    if (!state.ready || state.owner !== owner) return;
    const goals = validateGoals(input);
    latest.current = goals;
    let stored = false;
    try {
      stored = writeLocal(
        window.localStorage,
        owner,
        goals,
        revision.current,
        Boolean(owner),
      );
    } catch {
      /* report below */
    }
    setState((s) => ({
      ...s,
      goals,
      status: !stored
        ? "local-error"
        : owner
          ? ["conflict", "error"].includes(s.status)
            ? s.status
            : "saving"
          : "local",
      error: stored
        ? undefined
        : "기기 저장에 실패했습니다. JSON으로 백업해주세요.",
    }));
    if (owner && queue.current) {
      // Inputs commit on blur. Enqueue immediately so an older response cannot
      // acknowledge a newer edit that is still outside the queue.
      queue.current.save(goals);
    } else if (owner)
      setState((s) => ({
        ...s,
        status: s.status === "conflict" ? "conflict" : "error",
      }));
  }
  function retry() {
    if (queue.current) {
      queue.current.save(latest.current);
      queue.current.retry();
    } else setReload((n) => n + 1);
  }
  function refresh() {
    if (
      !window.confirm(
        "저장하지 못한 변경이 사라질 수 있습니다. JSON 백업 후 서버 보드를 다시 불러올까요?",
      )
    )
      return;
    // Keep a recovery copy before explicitly discarding the pending snapshot.
    try {
      localStorage.setItem(
        `mandalart:recovery:${owner ?? "guest"}:${Date.now()}`,
        JSON.stringify(latest.current),
      );
      writeLocal(localStorage, owner, latest.current, revision.current, false);
    } catch {
      return;
    }
    setReload((n) => n + 1);
  }
  function recover() {
    if (
      !window.confirm("원본을 내려받았나요? 현재 기기 보드를 새로 시작합니다.")
    )
      return;
    try {
      if (!writeLocal(localStorage, owner, [newRoot()], 0, false)) return;
    } catch {
      return;
    }
    setReload((n) => n + 1);
  }
  return {
    ...state,
    ready: state.ready && state.owner === owner && !pending,
    goals: state.owner === owner ? state.goals : [newRoot()],
    persist,
    retry,
    refresh,
    recover,
  };
}
