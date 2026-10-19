import { useBoardGoals } from "../model/useBoardGoals";
import { useToggleGoal } from "../../../features/toggle-goal";
import { childrenOf } from "../../../entities/board";
import { useIsMutating } from "@tanstack/react-query";
export function BoardGoals({
  boardId,
  onSelect,
}: {
  boardId: string;
  onSelect: (id: string) => void;
}) {
  const { data: goals = [] } = useBoardGoals(boardId),
    toggle = useToggleGoal(boardId),
    mutating = useIsMutating({
      predicate: (m) => m.options.scope?.id === `board:${boardId}`,
    });
  return (
    <section className="goals-widget" aria-label="목표 목록">
      <div className="widget-heading">
        <h2>목표 목록</h2>
        <span>{goals.length}</span>
      </div>
      {!goals.length && (
        <p className="empty-copy">보드의 빈 칸에서 목표를 추가하세요.</p>
      )}
      <ul>
        {goals.map((goal) => (
          <li key={goal.id}>
            <input
              type="checkbox"
              aria-label={`${goal.title} 완료 체크`}
              checked={goal.status === "done"}
              disabled={
                Boolean(mutating) || childrenOf(goals, goal.id).length > 0
              }
              onChange={() =>
                toggle.mutate({
                  goalId: goal.id,
                  status: goal.status === "done" ? "todo" : "done",
                })
              }
            />
            <button
              className={goal.status === "done" ? "done-title" : ""}
              onClick={() => onSelect(goal.id)}
            >
              {goal.title}
            </button>
            {goal.dueDate && (
              <time>{goal.dueDate.slice(5).replace("-", ".")}</time>
            )}
          </li>
        ))}
      </ul>
      {toggle.error && (
        <p role="alert" className="inline-error">
          저장하지 못해 이전 상태로 복구했습니다.
        </p>
      )}
    </section>
  );
}
