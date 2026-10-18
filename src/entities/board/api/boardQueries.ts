import { queryOptions } from "@tanstack/react-query";
import { getBoard, getBoards } from "./boardApi";
export const boardKeys = {
  all: ["boards"] as const,
  list: ["boards", "list"] as const,
  detail: (id: string) => ["boards", "detail", id] as const,
};
export const boardDetailOptions = (id: string) =>
  queryOptions({
    queryKey: boardKeys.detail(id),
    queryFn: ({ signal }) => getBoard(id, signal),
    staleTime: 30000,
    retry: false,
  });
export const boardListOptions = () =>
  queryOptions({
    queryKey: boardKeys.list,
    queryFn: ({ signal }) => getBoards(signal),
    staleTime: 30000,
    retry: false,
  });
