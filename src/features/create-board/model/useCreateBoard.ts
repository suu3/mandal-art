import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createBoard, boardKeys } from "../../../entities/board";
export function useCreateBoard() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: createBoard,
    onSuccess: (board) => {
      client.setQueryData(boardKeys.detail(board.id), board);
      void client.invalidateQueries({ queryKey: boardKeys.list });
    },
  });
}
