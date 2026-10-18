// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { getBoard, recoverLocalBoard } from "../src/entities/board";
afterEach(() => localStorage.clear());
it("exposes an original corrupt guest backup and preserves it during explicit recovery", async () => {
  localStorage.setItem("mandalart:v3:guest", "[broken");
  await expect(getBoard("local")).rejects.toMatchObject({
    status: 422,
    recovery: "[broken",
  });
  const key = recoverLocalBoard();
  expect(localStorage.getItem(key)).toBe("[broken");
  expect((await getBoard("local")).goals[0].id).toBe("root");
});
