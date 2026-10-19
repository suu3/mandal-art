import { useEffect, useRef, useState } from "react";
import { useIsMutating } from "@tanstack/react-query";
import { ChevronRight, Download, FileUp, RotateCcw } from "lucide-react";
import { useMandalartEditor } from "../model/useMandalartEditor";
import { MandalartView } from "./MandalartView";
import { useSaveBoard } from "../../../features/edit-goal";
import { useToggleGoal } from "../../../features/toggle-goal";
import { GoalEditor } from "../../../features/edit-goal";
import {
  childrenOf,
  newRoot,
  pathOf,
  parseBackup,
  type Goal,
} from "../../../entities/board";
import { exportJson, exportCsv, exportPng } from "../../../entities/board";
export function MandalartEditor({
  boardId,
  selectedId,
  onSelect,
  onDirtyChange,
}: {
  boardId: string;
  selectedId: string | null;
  onSelect: (id: string | null) => boolean;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const { data, isPending, error, refetch } = useMandalartEditor(boardId),
    save = useSaveBoard(boardId),
    toggle = useToggleGoal(boardId);
  const [currentId, setCurrentId] = useState("root"),
    [message, setMessage] = useState("");
  const busy = Boolean(
    useIsMutating({
      predicate: (m) => m.options.scope?.id === `board:${boardId}`,
    }),
  );
  const capture = useRef<HTMLDivElement>(null),
    file = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setCurrentId("root");
  }, [boardId]);
  if (isPending)
    return <div className="loading-panel">보드를 불러오는 중…</div>;
  if (error || !data)
    return (
      <div className="notice" role="alert">
        {error?.message ?? "보드를 찾지 못했습니다."}
        <button onClick={() => void refetch()}>다시 불러오기</button>
      </div>
    );
  const goals = data.goals,
    current =
      goals.find((g) => g.id === currentId) ??
      goals.find((g) => g.id === "root")!,
    selected = goals.find((g) => g.id === selectedId);
  async function commit(next: Goal[]) {
    try {
      await save.mutateAsync(next);
      setMessage("");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "저장하지 못했습니다.");
      throw e;
    }
  }
  function enter(id: string) {
    if (onSelect(null)) setCurrentId(id);
  }
  async function add(slot: number) {
    const goal: Goal = {
      ...newRoot(),
      id: crypto.randomUUID(),
      parentId: current.id,
      slot,
      title: "새 목표",
      description: "",
    };
    try {
      await commit([...goals, goal]);
      onSelect(goal.id);
    } catch {}
  }
  async function remove(goal: Goal) {
    if (!window.confirm(`“${goal.title}”와 하위 목표를 삭제할까요?`)) return;
    const ids = new Set([goal.id]);
    let changed = true;
    while (changed) {
      changed = false;
      goals.forEach((g) => {
        if (g.parentId && ids.has(g.parentId) && !ids.has(g.id)) {
          ids.add(g.id);
          changed = true;
        }
      });
    }
    try {
      await commit(goals.filter((g) => !ids.has(g.id)));
      onSelect(null);
    } catch {}
  }
  async function move(id: string, slot: number) {
    const goal = goals.find((g) => g.id === id);
    if (!goal || goal.parentId !== current.id) return;
    const other = childrenOf(goals, current.id).find((g) => g.slot === slot);
    try {
      await commit(
        goals.map((g) =>
          g.id === id
            ? { ...g, slot }
            : g.id === other?.id
              ? { ...g, slot: goal.slot }
              : g,
        ),
      );
    } catch {}
  }
  async function importFile(value: File | undefined) {
    if (!value) return;
    try {
      if (value.size > 262144)
        throw new Error("백업은 256KiB 이하여야 합니다.");
      const next = parseBackup(await value.text());
      if (
        !window.confirm(
          "현재 목표를 백업 파일로 교체할까요? 먼저 JSON 백업을 권장합니다.",
        )
      )
        return;
      await commit(next);
      enter("root");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "백업을 읽지 못했습니다.");
    }
  }
  return (
    <>
      <div className="editor-toolbar">
        <nav className="breadcrumbs" aria-label="목표 경로">
          {pathOf(goals, current.id).map((goal, i) => (
            <span key={goal.id}>
              {i > 0 && <ChevronRight size={13} />}
              <button disabled={busy} onClick={() => enter(goal.id)}>
                {i === 0 ? "중심 목표" : goal.title}
              </button>
            </span>
          ))}
        </nav>
        <details className="export-menu">
          <summary>내보내기 · 더보기</summary>
          <div className="dropdown">
            <button onClick={() => exportJson(goals)}>JSON 백업</button>
            <button onClick={() => exportCsv(goals)}>CSV 내보내기</button>
            <button
              onClick={() => {
                if (capture.current)
                  void exportPng(capture.current).catch(() =>
                    setMessage("이미지 저장에 실패했습니다."),
                  );
              }}
            >
              이미지 저장
            </button>
            <button disabled={busy} onClick={() => file.current?.click()}>
              백업 가져오기
            </button>
          </div>
        </details>
      </div>
      {(message || save.error || toggle.error) && (
        <div className="notice" role="alert">
          {message || save.error?.message || toggle.error?.message}
          <button
            disabled={busy}
            onClick={() => {
              void refetch();
              save.reset();
              toggle.reset();
              setMessage("");
            }}
          >
            최신 보드 다시 불러오기
          </button>
        </div>
      )}
      <input
        ref={file}
        type="file"
        accept=".json"
        className="visually-hidden"
        aria-label="JSON 백업 파일"
        onChange={(e) => {
          void importFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <div className="board-paper" ref={capture}>
        <MandalartView
          goals={goals}
          current={current}
          selectedId={selectedId}
          busy={busy}
          onSelect={onSelect}
          onEnter={enter}
          onAdd={(slot) => void add(slot)}
          onToggle={(goal) =>
            toggle.mutate({
              goalId: goal.id,
              status: goal.status === "done" ? "todo" : "done",
            })
          }
          onMove={(id, slot) => void move(id, slot)}
        />
      </div>
      <p className="editor-hint">
        이름을 눌러 편집 · 화살표로 하위 목표 보기 · 끌어서 순서 변경
      </p>
      {selected && (
        <>
          <button
            className="inspector-scrim"
            aria-label="목표 상세 닫기"
            onClick={() => onSelect(null)}
          />
          <GoalEditor
            onDirtyChange={onDirtyChange}
            goal={selected}
            busy={busy}
            error={save.error?.message}
            onSave={(patch) =>
              commit(
                goals.map((g) =>
                  g.id === selected.id
                    ? { ...g, ...patch, updatedAt: new Date().toISOString() }
                    : g,
                ),
              )
            }
            onClose={() => onSelect(null)}
            onEnter={() => enter(selected.id)}
            onDelete={() => void remove(selected)}
          />
        </>
      )}
    </>
  );
}
