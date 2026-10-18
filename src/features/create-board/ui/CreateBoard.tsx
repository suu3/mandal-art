import { useState } from "react";
import { Plus } from "lucide-react";
import { useCreateBoard } from "../model/useCreateBoard";
export function CreateBoard({
  onCreated,
}: {
  onCreated: (id: string) => void;
}) {
  const [open, setOpen] = useState(false),
    [title, setTitle] = useState(""),
    mutation = useCreateBoard();
  return (
    <div className="create-board">
      {!open ? (
        <button className="button primary" onClick={() => setOpen(true)}>
          <Plus size={17} />새 보드
        </button>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              const board = await mutation.mutateAsync(title);
              onCreated(board.id);
            } catch {}
          }}
        >
          <label htmlFor="new-board-title">보드 이름</label>
          <div>
            <input
              id="new-board-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={120}
              placeholder="예: 2027년 목표"
              autoFocus
              disabled={mutation.isPending}
            />
            <button
              type="submit"
              className="button primary"
              disabled={mutation.isPending || !title.trim()}
            >
              만들기
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => setOpen(false)}
            >
              취소
            </button>
          </div>
          {mutation.error && (
            <p role="alert" className="inline-error">
              {mutation.error.message}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
