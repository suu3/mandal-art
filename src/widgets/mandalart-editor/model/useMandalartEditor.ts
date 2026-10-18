import { useQuery } from "@tanstack/react-query";
import { boardDetailOptions, selectMandalart } from "../../../entities/board";
export const useMandalartEditor = (id: string) =>
  useQuery({ ...boardDetailOptions(id), select: selectMandalart });
