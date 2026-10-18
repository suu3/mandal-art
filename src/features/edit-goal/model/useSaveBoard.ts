import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  boardKeys,
  saveBoard,
  type Board,
  type Goal,
} from "../../../entities/board";
export function useSaveBoard(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationKey: ["save-board", id],
    scope: { id: `board:${id}` },
    retry: false,
    mutationFn: async (goals: Goal[]) => {
      const board = client.getQueryData<Board>(boardKeys.detail(id));
      if (!board) throw new Error("보드를 먼저 불러와주세요.");
      return saveBoard(id, goals, board.revision);
    },
    onSuccess: async (board) => {
      await client.cancelQueries({ queryKey: boardKeys.detail(id) });
      client.setQueryData(boardKeys.detail(id), board);
      void client.invalidateQueries({ queryKey: boardKeys.list });
    },
  });
}
