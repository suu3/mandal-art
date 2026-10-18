import type { Board } from "./types";
import { childrenOf } from "./goals";
export const selectBoardGoals = (board: Board) =>
  board.goals.filter((g) => g.parentId !== null);
export const selectBoardProgress = (board: Board) => {
  const leaves = board.goals.filter(
    (g) => g.parentId !== null && !childrenOf(board.goals, g.id).length,
  );
  const done = leaves.filter((g) => g.status === "done").length;
  return {
    total: leaves.length,
    done,
    percent: leaves.length ? Math.round((done / leaves.length) * 100) : 0,
  };
};
export const selectMandalart = (board: Board) => ({
  title: board.title,
  goals: board.goals,
});
