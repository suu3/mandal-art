import { afterEach, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
const checker = path.resolve("scripts/check-boundaries.mjs");
const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});
function check(file: string, source: string) {
  const root = mkdtempSync(path.join(tmpdir(), "fsd-"));
  roots.push(root);
  const target = path.join(root, "src", file);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, source);
  return spawnSync(process.execPath, [checker], {
    cwd: root,
    encoding: "utf8",
  });
}
it.each([
  'import { x } from "../../../features/edit-goal/model/useSaveBoard";',
  'export { x } from "../../../features/edit-goal/model/useSaveBoard";',
  'const x = import("../../../features/edit-goal/model/useSaveBoard");',
  'type X = import("../../../features/edit-goal/model/useSaveBoard").X;',
  'import "../../../features/edit-goal/model/useSaveBoard";',
])("rejects access to another slice's internals: %s", (source) => {
  const result = check("widgets/editor/ui/Editor.tsx", source);
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("public API");
});
it.each([
  'import { x } from "../../../features/edit-goal";',
  'import { x } from "../../../features/edit-goal/index.ts";',
  'import { x } from "../model/useEditor";',
  'import { x } from "../../../shared/api/client";',
  '// import { x } from "../../../features/edit-goal/model/private";\nconst text = "from \\\"../../../features/edit-goal/model/private\\\"";',
])("allows public APIs, local internals and shared segments: %s", (source) => {
  expect(check("widgets/editor/ui/Editor.tsx", source).status).toBe(0);
});
it("still rejects upward dependencies through a public API", () => {
  const result = check(
    "features/edit-goal/model/save.ts",
    'import { x } from "../../../widgets/editor";',
  );
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("cannot import");
});
it("still rejects dependencies between sibling slices", () => {
  const result = check(
    "features/edit-goal/model/save.ts",
    'import { x } from "../../toggle-goal";',
  );
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("cross-slice");
});
