import { siteOf } from "~/pins/pinnedPages";

export interface LinkRoutingCandidate<K> {
  readonly key: K;
  readonly title: string | null;
  readonly tabs: ReadonlyArray<{ readonly url: string; readonly title: string | null }>;
}

const STOP_WORDS = new Set([
  "www",
  "com",
  "org",
  "net",
  "io",
  "app",
  "dev",
  "http",
  "https",
  "html",
]);

function words(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((word) => word.length >= 3 && !STOP_WORDS.has(word) && !/^\d+$/.test(word)),
  );
}

function overlap(a: Set<string>, b: Set<string>): number {
  let count = 0;
  for (const word of a) if (b.has(word)) count++;
  return count;
}

/**
 * Picks the session an outside link most likely belongs to. A tab already on the link's site
 * counts most; shared words between the link and a session's title or tab titles break ties.
 * Returns null when nothing is a clear match, so the link gets a session of its own.
 */
export function bestSessionForLink<K>(
  url: string,
  candidates: ReadonlyArray<LinkRoutingCandidate<K>>,
): K | null {
  const site = siteOf(url);
  const parsed = URL.parse(url);
  const linkWords = words(parsed ? `${parsed.hostname} ${parsed.pathname}` : url);
  let best: { key: K; score: number } | null = null;
  let tied = false;
  for (const candidate of candidates) {
    const sameSiteTabs = candidate.tabs.filter((tab) => site !== null && siteOf(tab.url) === site);
    const titleWords = words(
      [candidate.title ?? "", ...candidate.tabs.map((tab) => tab.title ?? "")].join(" "),
    );
    const score = (sameSiteTabs.length > 0 ? 3 : 0) + overlap(linkWords, titleWords);
    if (score < 2) continue;
    if (!best || score > best.score) {
      best = { key: candidate.key, score };
      tied = false;
    } else if (score === best.score) {
      tied = true;
    }
  }
  return best && !tied ? best.key : null;
}
