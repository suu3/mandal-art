import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
const slicedLayers = ["entities", "features", "widgets", "pages"];
function moduleReferences(file) {
  const source = ts.createSourceFile(
    file,
    fs.readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const references = [];
  function visit(node) {
    let specifier;
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      specifier = node.moduleSpecifier;
    else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword
    )
      specifier = node.arguments[0];
    else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument))
      specifier = node.argument.literal;
    if (
      specifier &&
      ts.isStringLiteralLike(specifier) &&
      specifier.text.startsWith(".")
    )
      references.push(specifier.text);
    ts.forEachChild(node, visit);
  }
  visit(source);
  return references;
}
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
  for (const reference of moduleReferences(file)) {
    const target = path
      .relative(".", path.resolve(path.dirname(file), reference))
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
        `${file}: ${layer} cannot import ${target[1]} (${reference})`,
      );
    if (
      target[1] === layer &&
      target[2] !== slice &&
      slicedLayers.includes(layer)
    )
      failures.push(`${file}: cross-slice import ${reference}`);
    if (
      slicedLayers.includes(target[1]) &&
      !(target[1] === layer && target[2] === slice) &&
      !(
        target.length === 3 ||
        (target.length === 4 && /^index(?:\.tsx?)?$/.test(target[3]))
      )
    )
      failures.push(
        `${file}: use the ${target[1]}/${target[2]} public API (${reference})`,
      );
  }
}
if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else console.log("FSD layer boundaries passed.");
