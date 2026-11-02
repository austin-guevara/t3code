import { parseMarkdownWithMath } from "@t3tools/shared/markdownMath";

export type RichTextMark = "bold" | "italic" | "strike" | "code";

interface RichTextSpan {
  text: string;
  marks: RichTextMark[];
  href?: string;
}

export const RICH_TEXT_DELIMITERS: Record<RichTextMark, string> = {
  bold: "**",
  italic: "*",
  strike: "~~",
  code: "`",
};

function pushSpan(spans: RichTextSpan[], text: string, marks: RichTextMark[]): void {
  if (!text) return;
  const last = spans[spans.length - 1];
  if (
    last &&
    last.marks.length === marks.length &&
    last.marks.every((mark, index) => mark === marks[index])
  ) {
    last.text += text;
  } else {
    spans.push({ text, marks });
  }
}

export function composerLinkHref(text: string): string | null {
  if (!text || /[\s<>]/.test(text)) return null;
  try {
    const url = new URL(text);
    return ["http:", "https:", "mailto:"].includes(url.protocol) ? text : null;
  } catch {
    return null;
  }
}

export function composerLinkRanges(text: string) {
  if (!text.includes("://") && !text.includes("mailto:")) return [];
  const links: { start: number; end: number; label: string; href: string }[] = [];
  const tree = parseMarkdownWithMath(text);
  const visit = (node: typeof tree | (typeof tree.children)[number]) => {
    if (node.type === "link") {
      const start = node.position?.start.offset;
      const end = node.position?.end.offset;
      const href = composerLinkHref(node.url);
      if (start === undefined || end === undefined || !href) return;
      const labelStart = node.children[0]?.position?.start.offset;
      const labelEnd = node.children.at(-1)?.position?.end.offset;
      links.push({
        start,
        end,
        href,
        label:
          labelStart === undefined || labelEnd === undefined
            ? href
            : text.slice(labelStart, labelEnd),
      });
    } else if ("children" in node) node.children.forEach(visit);
  };
  visit(tree);
  return links;
}

export function parseInlineMarkdown(text: string): RichTextSpan[] {
  const links = composerLinkRanges(text);
  if (!links.length) return parseEmphasis(text);
  let sentinel = "\uFFFC";
  for (let codePoint = 0xe000; text.includes(sentinel); codePoint++)
    sentinel = String.fromCodePoint(codePoint);
  let cursor = 0;
  const shielded =
    links
      .map((link) => {
        const before = text.slice(cursor, link.start);
        cursor = link.end;
        return before + sentinel;
      })
      .join("") + text.slice(cursor);
  let linkIndex = 0;
  return parseEmphasis(shielded).flatMap((span) =>
    span.text.split(sentinel).flatMap((part, index) => {
      const result: RichTextSpan[] = [];
      if (index > 0) {
        const link = links[linkIndex++]!;
        for (const label of link.label === link.href
          ? [{ text: link.label, marks: [] }]
          : parseEmphasis(link.label))
          result.push({
            text: label.marks.includes("code")
              ? label.text
              : label.text.replace(/\\([\\[\]])/g, "$1"),
            marks: [...new Set([...span.marks, ...label.marks])],
            href: link.href,
          });
      }
      if (part) result.push({ text: part, marks: span.marks });
      return result;
    }),
  );
}

function parseEmphasis(text: string): RichTextSpan[] {
  const root: RichTextSpan[] = [];
  const stack: { delimiter: string; mark: RichTextMark; spans: RichTextSpan[] }[] = [];
  const current = () => stack.at(-1)?.spans ?? root;
  let index = 0;
  while (index < text.length) {
    const char = text[index]!;
    if (char === "\\") {
      pushSpan(current(), text.slice(index, index + 2), []);
      index += 2;
      continue;
    }
    if (char === "`") {
      const run = text.slice(index).match(/^`+/)![0];
      const close = text.indexOf(run, index + run.length);
      if (
        run.length === 1 &&
        close > index + 1 &&
        !text.slice(index, close).includes("\n") &&
        text[close + 1] !== "`"
      ) {
        pushSpan(current(), text.slice(index + 1, close), ["code"]);
        index = close + 1;
      } else {
        pushSpan(current(), run, []);
        index += run.length;
      }
      continue;
    }
    if (char !== "*" && char !== "_" && char !== "~") {
      pushSpan(current(), char, []);
      index += 1;
      continue;
    }
    let end = index;
    while (text[end] === char) end += 1;
    const before = text[index - 1] ?? "";
    const after = text[end] ?? "";
    const canClose = before !== "" && !/\s/.test(before) && (char !== "_" || !/\w/.test(after));
    const canOpen = after !== "" && !/\s/.test(after) && (char !== "_" || !/\w/.test(before));
    while (index < end) {
      const top = stack.at(-1);
      const opensNestedBold =
        top?.mark === "italic" &&
        end - index === 2 &&
        canOpen &&
        (char === "*" || char === "_") &&
        !stack.some((frame) => frame.mark === "bold");
      if (
        !opensNestedBold &&
        canClose &&
        top &&
        text.startsWith(top.delimiter, index) &&
        index + top.delimiter.length <= end
      ) {
        stack.pop();
        for (const span of top.spans) pushSpan(current(), span.text, [top.mark, ...span.marks]);
        index += top.delimiter.length;
      } else if (canOpen && (char !== "~" || end - index >= 2)) {
        const length = char === "~" || end - index >= 2 ? 2 : 1;
        const mark = char === "~" ? "strike" : length === 2 ? "bold" : "italic";
        // Prevent self-nesting, including alternate delimiters, to bound the stack by supported styles.
        if (stack.some((frame) => frame.mark === mark)) {
          pushSpan(current(), text.slice(index, end), []);
          index = end;
          continue;
        }
        stack.push({
          delimiter: char.repeat(length),
          mark,
          spans: [],
        });
        index += length;
      } else {
        pushSpan(current(), text.slice(index, end), []);
        index = end;
      }
    }
  }
  while (stack.length > 0) {
    const frame = stack.pop()!;
    pushSpan(current(), frame.delimiter, []);
    for (const span of frame.spans) pushSpan(current(), span.text, span.marks);
  }
  return root;
}
