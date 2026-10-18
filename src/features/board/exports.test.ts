import { expect, it } from "vitest";
import { newRoot, parseBackup, validateGoals } from "../../domain/goals";
import { serializeBackup } from "./exports";
it("round-trips an accepted board near the file size limit through JSON export", () => {
  const goals = validateGoals(
    Array.from({ length: 66 }, (_, i) => ({
      ...newRoot(),
      id: i ? `g${i}` : "root",
      parentId: i ? (i === 1 ? "root" : `g${i - 1}`) : null,
      description: "x".repeat(3620),
    })),
  );
  const text = serializeBackup(goals);
  expect(new TextEncoder().encode(text).length).toBeLessThanOrEqual(262144);
  expect(parseBackup(text)).toEqual(goals);
});
