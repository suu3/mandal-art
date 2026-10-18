import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Check, Trash2, X } from "lucide-react";
import { childrenOf, progressOf, type Goal } from "../../domain/goals";
import { useDialogFocus } from "./use-dialog-focus";

export function Inspector({
  goal,
  goals,
  onPatch,
  onClose,
  onEnter,
  onDelete,
}: {
  goal: Goal;
  goals: Goal[];
  onPatch: (patch: Partial<Goal>) => void;
  onClose: () => void;
  onEnter: () => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(goal.title);
  const [description, setDescription] = useState(goal.description);
  const close = useRef<HTMLButtonElement>(null);
  const scope = useRef<HTMLElement>(null);
  const mobile = matchMedia("(max-width: 1050px)").matches;
  useDialogFocus(scope, mobile, onClose);
  const closeAction = useRef(onClose);
  closeAction.current = onClose;
  const hasChildren = childrenOf(goals, goal.id).length > 0;
  useEffect(() => {
    setTitle(goal.title);
    setDescription(goal.description);
  }, [goal.id, goal.title, goal.description]);
  useEffect(() => {
    if (matchMedia("(max-width: 1050px)").matches) close.current?.focus();
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAction.current();
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [goal.id]);
  return (
    <aside
      ref={scope}
      className="inspector"
      role={mobile ? "dialog" : undefined}
      aria-modal={mobile || undefined}
      aria-label="목표 상세 편집"
    >
      <div className="inspector-top">
        <span className="eyebrow">GOAL DETAILS</span>
        <button
          ref={close}
          className="icon-button"
          aria-label="상세 닫기"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>
      <div className="detail-index">
        {goal.parentId === null
          ? "중심 목표"
          : `실천 ${String(goal.slot + 1).padStart(2, "0")}`}
      </div>
      <label className="field-label" htmlFor="goal-title">
        목표 이름
      </label>
      <input
        id="goal-title"
        className="title-input"
        value={title}
        maxLength={120}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => {
          const value = title.trim() || goal.title;
          setTitle(value);
          if (value !== goal.title) onPatch({ title: value });
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
      <div className="detail-progress">
        <span>지금까지의 걸음</span>
        <strong>{progressOf(goals, goal.id)}%</strong>
      </div>
      <div className="progress-track">
        <i style={{ width: `${progressOf(goals, goal.id)}%` }} />
      </div>
      <label className="field-label" htmlFor="goal-description">
        이 목표를 이루고 싶은 이유
      </label>
      <textarea
        id="goal-description"
        value={description}
        maxLength={4000}
        rows={5}
        placeholder="작은 생각이라도 남겨보세요."
        onChange={(e) => setDescription(e.target.value)}
        onBlur={() => {
          if (description !== goal.description) onPatch({ description });
        }}
      />
      <div className="field-row">
        <label>
          우선순위
          <select
            value={goal.priority}
            onChange={(e) =>
              onPatch({ priority: e.target.value as Goal["priority"] })
            }
          >
            <option value="low">천천히</option>
            <option value="medium">꾸준히</option>
            <option value="high">먼저 집중</option>
          </select>
        </label>
        <label>
          목표 날짜
          <input
            type="date"
            value={goal.dueDate ?? ""}
            onChange={(e) => onPatch({ dueDate: e.target.value || null })}
          />
        </label>
      </div>
      <label className="field-label" htmlFor="goal-status">
        진행 상태
      </label>
      <select
        id="goal-status"
        disabled={hasChildren}
        value={goal.status}
        onChange={(e) => onPatch({ status: e.target.value as Goal["status"] })}
      >
        <option value="todo">시작 전</option>
        <option value="doing">진행 중</option>
        <option value="done">완료</option>
      </select>
      {hasChildren && (
        <p className="field-help">
          하위 목표의 완료 상태로 진행률이 계산됩니다.
        </p>
      )}
      <button className="button primary detail-action" onClick={onEnter}>
        작은 실천으로 나누기
        <ArrowUpRight size={17} />
      </button>
      {!hasChildren && (
        <button
          className={`button secondary ${goal.status === "done" ? "is-done" : ""}`}
          onClick={() =>
            onPatch({ status: goal.status === "done" ? "todo" : "done" })
          }
        >
          <Check size={17} />
          {goal.status === "done" ? "완료 취소하기" : "이 목표를 완료했어요"}
        </button>
      )}
      {goal.parentId !== null && (
        <button className="text-button danger delete-goal" onClick={onDelete}>
          <Trash2 size={15} />
          목표 삭제{hasChildren ? " (하위 목표 포함)" : ""}
        </button>
      )}
      <div className="detail-note">
        큰 변화는
        <br />
        <em>작은 실천에서 시작돼요.</em>
        <span>한 번에 한 걸음이면 충분해요.</span>
      </div>
    </aside>
  );
}
