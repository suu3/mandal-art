import { useEffect, useRef, useState } from "react";
import { X, ArrowUpRight, Trash2 } from "lucide-react";
import type { Goal } from "../../../entities/board";
import { useDialogFocus } from "../../../shared/lib/use-dialog-focus";
export function GoalEditor({
  goal,
  busy,
  error,
  onSave,
  onClose,
  onEnter,
  onDelete,
  onDirtyChange,
}: {
  goal: Goal;
  busy: boolean;
  error?: string;
  onSave: (patch: Partial<Goal>) => Promise<unknown>;
  onClose: () => void;
  onEnter: () => void;
  onDelete: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [title, setTitle] = useState(goal.title),
    [description, setDescription] = useState(goal.description),
    [priority, setPriority] = useState(goal.priority),
    [dueDate, setDueDate] = useState(goal.dueDate ?? "");
  const scope = useRef<HTMLElement>(null);
  const baseline = useRef(goal);
  useDialogFocus(scope, matchMedia("(max-width:1050px)").matches, onClose);
  useEffect(() => {
    const previous = baseline.current;
    const changedGoal = goal.id !== previous.id;
    setTitle((value) =>
      changedGoal || value === previous.title ? goal.title : value,
    );
    setDescription((value) =>
      changedGoal || value === previous.description ? goal.description : value,
    );
    setPriority((value) =>
      changedGoal || value === previous.priority ? goal.priority : value,
    );
    setDueDate((value) =>
      changedGoal || value === (previous.dueDate ?? "")
        ? (goal.dueDate ?? "")
        : value,
    );
    baseline.current = goal;
  }, [goal.id, goal.title, goal.description, goal.priority, goal.dueDate]);
  const dirty =
    title !== goal.title ||
    description !== goal.description ||
    priority !== goal.priority ||
    dueDate !== (goal.dueDate ?? "");
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    const navigate = (event: MouseEvent) => {
      const link = (event.target as Element).closest?.("a[href]");
      if (link && !window.confirm("저장하지 않은 변경을 버리고 이동할까요?")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", navigate, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", navigate, true);
    };
  }, [dirty]);
  return (
    <aside ref={scope} className="inspector" aria-label="목표 상세 편집">
      <div className="inspector-top">
        <h2>목표 편집</h2>
        <button
          className="icon-button"
          aria-label="상세 닫기"
          onClick={onClose}
        >
          <X size={19} />
        </button>
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await onSave({
              title: title.trim(),
              description,
              priority,
              dueDate: dueDate || null,
            });
            setTitle(title.trim());
          } catch {}
        }}
      >
        <label className="field-label" htmlFor="goal-title">
          목표 이름
        </label>
        <input
          id="goal-title"
          className="title-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          required
          disabled={busy}
        />
        <label className="field-label" htmlFor="goal-description">
          메모
        </label>
        <textarea
          id="goal-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          maxLength={4000}
          disabled={busy}
        />
        <div className="field-row">
          <label>
            우선순위
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Goal["priority"])}
              disabled={busy}
            >
              <option value="low">낮음</option>
              <option value="medium">보통</option>
              <option value="high">높음</option>
            </select>
          </label>
          <label>
            기한
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              disabled={busy}
            />
          </label>
        </div>
        {error && (
          <p className="inline-error" role="alert">
            {error} 입력한 내용은 그대로 남아 있습니다.
          </p>
        )}
        <button
          className="button primary save-edit"
          type="submit"
          disabled={busy || !dirty || !title.trim()}
        >
          {busy ? "저장 중…" : "변경 저장"}
        </button>
      </form>
      <button
        className="button secondary detail-action"
        disabled={busy || dirty}
        onClick={onEnter}
      >
        하위 목표 보기
        <ArrowUpRight size={16} />
      </button>
      {goal.parentId && (
        <button
          className="text-button danger delete-goal"
          disabled={busy || dirty}
          onClick={onDelete}
        >
          <Trash2 size={15} />
          목표 삭제
        </button>
      )}
      {dirty && (
        <p className="field-help">
          변경 내용을 저장한 뒤 다른 목표로 이동하세요.
        </p>
      )}
    </aside>
  );
}
