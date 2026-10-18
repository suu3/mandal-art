// @vitest-environment jsdom
import {
  cleanup,
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { QueryProvider } from "../src/app/providers/QueryProvider";
import {
  boardDetailOptions,
  boardKeys,
  type Board,
  newRoot,
} from "../src/entities/board";
import { useSaveBoard } from "../src/features/edit-goal/model/useSaveBoard";
import { GoalEditor } from "../src/features/edit-goal/ui/GoalEditor";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("retains a draft when another view updates completion on the same goal", () => {
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  const goal = newRoot(),
    handlers = {
      busy: false,
      onClose: () => {},
      onEnter: () => {},
      onDelete: () => {},
      onSave: async () => {},
    };
  const view = render(<GoalEditor goal={goal} {...handlers} />);
  fireEvent.change(screen.getByRole("textbox", { name: "목표 이름" }), {
    target: { value: "작성 중인 변경" },
  });
  view.rerender(
    <GoalEditor
      goal={{ ...goal, status: "done", updatedAt: "2026-10-19T01:00:00.000Z" }}
      {...handlers}
    />,
  );
  expect(
    (screen.getByRole("textbox", { name: "목표 이름" }) as HTMLInputElement)
      .value,
  ).toBe("작성 중인 변경");
});
const initial = () => {
  const root = newRoot();
  return {
    id: "test",
    title: root.title,
    revision: 0,
    goals: [root],
    createdAt: root.createdAt,
    updatedAt: root.updatedAt,
  };
};
it("refreshes untouched fields while preserving edited fields on a same-goal refetch", () => {
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  const goal = newRoot();
  const handlers = {
    busy: false,
    onClose: () => {},
    onEnter: () => {},
    onDelete: () => {},
    onSave: async () => {},
  };
  const view = render(<GoalEditor goal={goal} {...handlers} />);
  fireEvent.change(screen.getByRole("textbox", { name: "메모" }), {
    target: { value: "작성 중 메모" },
  });
  view.rerender(
    <GoalEditor
      goal={{ ...goal, title: "다른 창에서 수정", description: "서버 메모" }}
      {...handlers}
    />,
  );
  expect(
    (screen.getByRole("textbox", { name: "목표 이름" }) as HTMLInputElement)
      .value,
  ).toBe("다른 창에서 수정");
  expect(
    (screen.getByRole("textbox", { name: "메모" }) as HTMLInputElement).value,
  ).toBe("작성 중 메모");
});
it("keeps form drafts outside the server cache until explicit save succeeds", async () => {
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  let cached: Board | undefined;
  const board = initial();
  vi.stubGlobal("fetch", async (_url: string, init?: RequestInit) =>
    Response.json(
      init?.method === "PUT"
        ? { ...board, revision: 1, ...JSON.parse(init.body as string) }
        : board,
    ),
  );
  function Harness() {
    const query = useQuery(boardDetailOptions("test")),
      save = useSaveBoard("test"),
      client = useQueryClient();
    cached = client.getQueryData(boardKeys.detail("test"));
    return query.data ? (
      <GoalEditor
        goal={query.data.goals[0]}
        busy={save.isPending}
        onClose={() => {}}
        onEnter={() => {}}
        onDelete={() => {}}
        onSave={(patch) =>
          save.mutateAsync(query.data!.goals.map((g) => ({ ...g, ...patch })))
        }
      />
    ) : null;
  }
  render(
    <QueryProvider>
      <Harness />
    </QueryProvider>,
  );
  const input = await screen.findByRole("textbox", { name: "목표 이름" });
  fireEvent.change(input, { target: { value: "작성 중인 제목" } });
  expect(cached?.goals[0].title).toBe("내가 만들어갈 한 해");
  fireEvent.click(screen.getByRole("button", { name: "변경 저장" }));
  await waitFor(() => expect(cached?.goals[0].title).toBe("작성 중인 제목"));
});
it("discards the old query cache when the account boundary changes", async () => {
  let originalClient: ReturnType<typeof useQueryClient> | undefined;
  function Read({ capture = false }: { capture?: boolean }) {
    const client = useQueryClient();
    if (capture) {
      originalClient = client;
      client.setQueryData(["private"], { title: "A private" });
    }
    const data = client.getQueryData<{ title: string }>(["private"]);
    return <span>{data?.title ?? "empty"}</span>;
  }
  const view = render(
    <QueryProvider key="A">
      <Read capture />
    </QueryProvider>,
  );
  expect(screen.getByText("A private")).toBeTruthy();
  view.rerender(
    <QueryProvider key="B">
      <Read />
    </QueryProvider>,
  );
  expect(screen.getByText("empty")).toBeTruthy();
  expect(originalClient?.getQueryData(["private"])).toBeUndefined();
});
