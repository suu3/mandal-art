import { z } from "zod";
import { validateGoals } from "./goals";
export type { Goal } from "./goals";
export const boardSummarySchema = z.object({
  id: z.string().min(1).max(128),
  title: z.string().min(1).max(120),
  revision: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export const boardSchema = boardSummarySchema.extend({
  goals: z.unknown().transform((value, ctx) => {
    try {
      return validateGoals(value);
    } catch {
      ctx.addIssue({
        code: "custom",
        message: "보드의 목표 형식이 올바르지 않습니다.",
      });
      return z.NEVER;
    }
  }),
});
export type Board = z.infer<typeof boardSchema>;
export type BoardSummary = z.infer<typeof boardSummarySchema>;
