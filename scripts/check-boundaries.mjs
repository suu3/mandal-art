import fs from "node:fs";
import path from "node:path";
const layers = ["shared", "entities", "features", "widgets", "pages", "app"];
const walk = (dir) =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((d) =>
      d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)],
    );
const failures = [];
for (const file of walk("src").filter(
  (f) => /\.tsx?$/.test(f) && !f.includes(".test."),
)) {
  const parts = file.replaceAll("\\", "/").split("/"),
    layer = parts[1],
    slice = parts[2];
  for (const match of fs
    .readFileSync(file, "utf8")
    .matchAll(/(?:from|import)\s+["'](\.[^"']+)["']/g)) {
    const target = path
      .relative(".", path.resolve(path.dirname(file), match[1]))
      .replaceAll("\\", "/")
      .split("/");
    if (
      target[0] !== "src" ||
      !layers.includes(layer) ||
      !layers.includes(target[1])
    )
      continue;
    if (layers.indexOf(target[1]) > layers.indexOf(layer))
      failures.push(
        `${file}: ${layer} cannot import ${target[1]} (${match[1]})`,
      );
    if (
      target[1] === layer &&
      target[2] !== slice &&
      ["entities", "features", "widgets", "pages"].includes(layer)
    )
      failures.push(`${file}: cross-slice import ${match[1]}`);
  }
}
if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else console.log("FSD layer boundaries passed.");
