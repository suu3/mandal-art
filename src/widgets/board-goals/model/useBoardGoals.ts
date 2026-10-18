import { useQuery } from "@tanstack/react-query";
import { boardDetailOptions, selectBoardGoals } from "../../../entities/board";
export const useBoardGoals = (id: string) =>
  useQuery({ ...boardDetailOptions(id), select: selectBoardGoals });
