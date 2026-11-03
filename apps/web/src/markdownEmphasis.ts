import type { Emphasis, Root, RootContent, Strong } from "mdast";
import type { VFile } from "vfile";
import { parseMarkdownWithMath } from "@t3tools/shared/markdownMath";
import type { ComposerEmphasisStyle } from "./composer-rich-text";

function visitEmphasis(node: Root | RootContent, visit: (node: Emphasis | Strong) => void): void {
  if (node.type === "emphasis" || node.type === "strong") visit(node);
  if ("children" in node) node.children.forEach((child) => visitEmphasis(child, visit));
}

function emphasisTag(node: Emphasis | Strong, text: string, style: ComposerEmphasisStyle) {
  return node.type === "strong" || (style === "slack" && text[node.position!.start.offset!] === "*")
    ? "strong"
    : "em";
}

export function markdownEmphasisRanges(text: string, style: ComposerEmphasisStyle) {
  const ranges: { from: number; to: number; tag: "strong" | "em" }[] = [];
  if (!/[*_]/.test(text)) return ranges;
  visitEmphasis(parseMarkdownWithMath(text), (node) => {
    const start = node.position?.start.offset;
    const end = node.position?.end.offset;
    if (start === undefined || end === undefined) return;
    const width = node.type === "strong" ? 2 : 1;
    ranges.push({ from: start + width, to: end - width, tag: emphasisTag(node, text, style) });
  });
  return ranges;
}

export function remarkSlackEmphasis() {
  return (tree: Root, file: VFile) => {
    const text = String(file.value);
    visitEmphasis(tree, (node) => {
      if (node.position?.start.offset !== undefined)
        node.data = { ...node.data, hName: emphasisTag(node, text, "slack") };
    });
  };
}
