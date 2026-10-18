import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteBoard, boardKeys } from "../../../entities/board";
export function useDeleteBoard() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, revision }: { id: string; revision: number }) =>
      deleteBoard(id, revision),
    onSuccess: (_v, input) => {
      client.removeQueries({ queryKey: boardKeys.detail(input.id) });
      void client.invalidateQueries({ queryKey: boardKeys.list });
    },
  });
}
