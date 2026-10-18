import { useMutation, useQueryClient } from "@tanstack/react-query";
import { boardKeys, saveBoard, type Board } from "../../../entities/board";
export function useToggleGoal(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationKey: ["toggle-goal", id],
    scope: { id: `board:${id}` },
    retry: false,
    mutationFn: async ({
      goalId,
      status,
    }: {
      goalId: string;
      status: "todo" | "done";
    }) => {
      const board = client.getQueryData<Board>(boardKeys.detail(id));
      if (!board) throw new Error("보드가 없습니다.");
      const goals = board.goals.map((g) =>
        g.id === goalId
          ? { ...g, status, updatedAt: new Date().toISOString() }
          : g,
      );
      return saveBoard(id, goals, board.revision);
    },
    onMutate: async ({ goalId, status }) => {
      await client.cancelQueries({ queryKey: boardKeys.detail(id) });
      const previous = client.getQueryData<Board>(boardKeys.detail(id));
      if (previous)
        client.setQueryData(boardKeys.detail(id), {
          ...previous,
          goals: previous.goals.map((g) =>
            g.id === goalId ? { ...g, status } : g,
          ),
        });
      return { previous };
    },
    onError: (_error, _input, ctx) => {
      if (ctx?.previous)
        client.setQueryData(boardKeys.detail(id), ctx.previous);
    },
    onSuccess: (board) => {
      client.setQueryData(boardKeys.detail(id), board);
      void client.invalidateQueries({ queryKey: boardKeys.list });
    },
  });
}
