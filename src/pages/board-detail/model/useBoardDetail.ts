import { useQuery } from "@tanstack/react-query";
import { boardDetailOptions } from "../../../entities/board";
export const useBoardDetail = (id: string) => useQuery(boardDetailOptions(id));
