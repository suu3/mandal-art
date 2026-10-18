import { Check, ArrowUpRight, Plus } from "lucide-react";
import { useState } from "react";
import type { Goal } from "../../../entities/board";
import { childrenOf, progressOf } from "../../../entities/board";
type Props = {
  goals: Goal[];
  current: Goal;
  selectedId: string | null;
  busy: boolean;
  onSelect: (id: string) => void;
  onEnter: (id: string) => void;
  onAdd: (slot: number) => void;
  onToggle: (goal: Goal) => void;
  onMove: (id: string, slot: number) => void;
};
export function MandalartView({
  goals,
  current,
  selectedId,
  busy,
  onSelect,
  onEnter,
  onAdd,
  onToggle,
  onMove,
}: Props) {
  const children = childrenOf(goals, current.id),
    [dragged, setDragged] = useState<string | null>(null);
  return (
    <div className="mandala-grid" aria-label="만다라트 목표 보드">
      {Array.from({ length: 9 }, (_, index) => {
        if (index === 4)
          return (
            <div className="goal-card core-card" key="root">
              <span className="card-kicker">중심 목표</span>
              <button
                className="core-title"
                disabled={busy}
                onClick={() => onSelect(current.id)}
              >
                {current.title}
              </button>
              <p>{current.description || "중심 목표를 작성하세요."}</p>
              <button
                className="core-edit"
                disabled={busy}
                aria-label="중심 목표 편집"
                onClick={() => onSelect(current.id)}
              >
                <ArrowUpRight size={18} />
              </button>
            </div>
          );
        const slot = index < 4 ? index : index - 1,
          goal = children.find((g) => g.slot === slot);
        return (
          <div
            key={slot}
            className={`goal-card ${goal ? "" : "empty-card"} ${goal?.status === "done" ? "completed" : ""} ${selectedId === goal?.id ? "selected" : ""}`}
            draggable={Boolean(goal && !busy)}
            onDragStart={() => setDragged(goal?.id ?? null)}
            onDragEnd={() => setDragged(null)}
            onDragOver={(e) => {
              if (dragged) e.preventDefault();
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragged && !busy) onMove(dragged, slot);
              setDragged(null);
            }}
          >
            {goal ? (
              <>
                <div className="card-top">
                  <span className="card-number">
                    {String(slot + 1).padStart(2, "0")}
                  </span>
                  <span className={`status-tag ${goal.status}`}>
                    {goal.status === "done"
                      ? "완료"
                      : goal.status === "doing"
                        ? "진행 중"
                        : "시작 전"}
                  </span>
                </div>
                <button
                  className="card-title"
                  disabled={busy}
                  onClick={() => onSelect(goal.id)}
                >
                  {goal.title}
                </button>
                <p className="card-description">{goal.description}</p>
                <div className="card-bottom">
                  {childrenOf(goals, goal.id).length ? (
                    <span className="subgoal-progress">
                      {childrenOf(goals, goal.id).length}개 하위 목표 ·{" "}
                      {progressOf(goals, goal.id)}%
                    </span>
                  ) : (
                    <button
                      className={`completion-button ${goal.status === "done" ? "checked" : ""}`}
                      disabled={busy}
                      aria-label={`${goal.title} ${goal.status === "done" ? "완료 취소" : "완료하기"}`}
                      onClick={() => onToggle(goal)}
                    >
                      {goal.status === "done" ? <Check size={14} /> : <span />}
                      <span>
                        {goal.status === "done" ? "완료" : "완료하기"}
                      </span>
                    </button>
                  )}
                  <button
                    className="enter-goal"
                    disabled={busy}
                    aria-label={`${goal.title} 하위 목표 보기`}
                    onClick={() => onEnter(goal.id)}
                  >
                    <ArrowUpRight size={18} />
                  </button>
                </div>
              </>
            ) : (
              <button
                className="add-goal"
                disabled={busy}
                onClick={() => onAdd(slot)}
              >
                <span className="empty-number">
                  {String(slot + 1).padStart(2, "0")}
                </span>
                <Plus size={22} strokeWidth={1.4} />
                <span>목표 추가</span>
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
