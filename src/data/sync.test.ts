import { describe, expect, it } from "vitest";
import { SaveQueue } from "./sync";
import { newRoot } from "../domain/goals";
describe("revisioned save queue", () => {
  it("serializes edits using the revision returned by the previous save", async () => {
    const received: number[] = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const queue = new SaveQueue(
      0,
      async (goals, revision) => {
        received.push(revision);
        if (!revision) await gate;
        return { goals, revision: revision + 1 };
      },
      () => {},
    );
    queue.save([newRoot()]);
    queue.save([{ ...newRoot(), title: "new" }]);
    await Promise.resolve();
    expect(received).toEqual([0]);
    release();
    await queue.idle();
    expect(received).toEqual([0, 1]);
    expect(queue.revision).toBe(2);
  });
  it("retains edits after failure and retries the most recent snapshot", async () => {
    let fail = true;
    const saved: string[] = [];
    const states: string[] = [];
    const queue = new SaveQueue(
      4,
      async (goals, revision) => {
        if (fail) throw new Error("offline");
        saved.push(goals[0].title);
        return { goals, revision: revision + 1 };
      },
      (state) => states.push(state),
    );
    queue.save([{ ...newRoot(), title: "keep me" }]);
    await queue.idle();
    expect(states.at(-1)).toBe("error");
    fail = false;
    queue.retry();
    await queue.idle();
    expect(saved).toEqual(["keep me"]);
    expect(queue.revision).toBe(5);
  });
  it("stops on conflict and refuses blind retry", async () => {
    let count = 0;
    const states: string[] = [];
    const queue = new SaveQueue(
      0,
      async () => {
        count++;
        throw Object.assign(new Error("conflict"), { status: 409 });
      },
      (s) => states.push(s),
    );
    queue.save([newRoot()]);
    await queue.idle();
    queue.retry();
    await queue.idle();
    expect(count).toBe(1);
    expect(states.at(-1)).toBe("conflict");
  });
  it("does not deliver stale success after switching accounts", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const states: string[] = [];
    const queue = new SaveQueue(
      0,
      async (goals) => {
        await gate;
        return { goals, revision: 1 };
      },
      (s) => states.push(s),
    );
    queue.save([newRoot()]);
    queue.dispose();
    release();
    await queue.idle();
    expect(states).not.toContain("saved");
  });
});
