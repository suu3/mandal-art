import { toPng } from "html-to-image";
import type { Goal } from "../model/goals";
export function download(
  name: string,
  content: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const serializeBackup = (goals: Goal[]) =>
  JSON.stringify({ version: 3, exportedAt: new Date().toISOString(), goals });
export const exportJson = (goals: Goal[]) =>
  download("mandalart-backup.json", serializeBackup(goals));
export function exportCsv(goals: Goal[]) {
  const cell = (v: unknown) => {
    let text = String(v ?? "");
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  download(
    "mandalart.csv",
    "\uFEFF" +
      [
        [
          "id",
          "parent_id",
          "title",
          "description",
          "status",
          "priority",
          "due_date",
        ],
        ...goals.map((g) => [
          g.id,
          g.parentId,
          g.title,
          g.description,
          g.status,
          g.priority,
          g.dueDate,
        ]),
      ]
        .map((row) => row.map(cell).join(","))
        .join("\r\n"),
    "text/csv;charset=utf-8",
  );
}
export async function exportPng(node: HTMLElement) {
  const url = await toPng(node, {
    pixelRatio: 2,
    backgroundColor: getComputedStyle(document.documentElement)
      .getPropertyValue("--paper")
      .trim(),
    filter: (node) =>
      !(node instanceof HTMLElement && node.dataset.export === "hide"),
  });
  const link = document.createElement("a");
  link.href = url;
  link.download = "mandalart-board.png";
  link.click();
}
