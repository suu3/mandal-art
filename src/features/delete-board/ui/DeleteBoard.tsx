import { Trash2 } from "lucide-react";
import { useDeleteBoard } from "../model/useDeleteBoard";
import type { BoardSummary } from "../../../entities/board";
export function DeleteBoard({
  board,
  onDeleted,
}: {
  board: BoardSummary;
  onDeleted: () => void;
}) {
  const mutation = useDeleteBoard();
  return (
    <>
      <button
        className="text-button danger"
        disabled={mutation.isPending}
        onClick={async () => {
          if (!window.confirm(`“${board.title}” 보드를 목록에서 삭제할까요?`))
            return;
          try {
            await mutation.mutateAsync({
              id: board.id,
              revision: board.revision,
            });
            onDeleted();
          } catch {}
        }}
      >
        <Trash2 size={14} />
        {mutation.isPending ? "삭제 중…" : "보드 삭제"}
      </button>
      {mutation.error && (
        <p role="alert" className="inline-error">
          {mutation.error.message}
        </p>
      )}
    </>
  );
}
