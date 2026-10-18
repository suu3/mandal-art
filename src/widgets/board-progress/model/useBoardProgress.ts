import { useQuery } from "@tanstack/react-query";
import {
  boardDetailOptions,
  selectBoardProgress,
} from "../../../entities/board";
export const useBoardProgress = (id: string) =>
  useQuery({ ...boardDetailOptions(id), select: selectBoardProgress });
