import { resolveAddressBarInput, resolveSearchUrlTemplate } from "@t3tools/shared/preview";

import { getClientSettings } from "~/hooks/useSettings";

const NOT_AN_ADDRESS = "https://not-an-address.invalid/?q=%s";
const NOT_AN_ADDRESS_PREFIX = NOT_AN_ADDRESS.slice(0, NOT_AN_ADDRESS.indexOf("%s"));

// A bare name with one of these endings is more likely a file than a site.
const FILE_ENDINGS = new Set([
  "c",
  "cc",
  "cjs",
  "cpp",
  "css",
  "go",
  "h",
  "html",
  "java",
  "js",
  "json",
  "jsx",
  "kt",
  "lock",
  "log",
  "md",
  "mdx",
  "mjs",
  "php",
  "py",
  "rb",
  "rs",
  "scss",
  "sh",
  "sql",
  "svg",
  "swift",
  "toml",
  "ts",
  "tsx",
  "txt",
  "vue",
  "xml",
  "yaml",
  "yml",
  "zsh",
]);

/** The page a composer's text names, when the whole text is one address. */
export function addressFromText(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.length === 0 || /\s/.test(trimmed)) return null;
  const hasScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed);
  if (!hasScheme && !trimmed.includes("/")) {
    const ending = trimmed.split(":", 1)[0]!.split(".").at(-1)?.toLowerCase() ?? "";
    if (FILE_ENDINGS.has(ending)) return null;
  }
  try {
    const resolved = resolveAddressBarInput(trimmed, NOT_AN_ADDRESS);
    return resolved.startsWith(NOT_AN_ADDRESS_PREFIX) ? null : resolved;
  } catch {
    return null;
  }
}

/** A web search for the text, with the search engine chosen in settings. */
export function searchUrlFor(text: string): string {
  return resolveAddressBarInput(text, resolveSearchUrlTemplate(getClientSettings()));
}
