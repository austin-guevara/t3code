import { useGT } from "gt-react";
import { GlobeIcon, MessageSquareIcon, SearchIcon } from "lucide-react";
import { type ReactNode, useState } from "react";

import { ITEM_ICON_CLASS } from "~/components/CommandPalette.logic";

import { addressFromText, searchUrlFor } from "./addressEntry";
import { useBrowserPaletteItems } from "./useBrowserPaletteItems";

export interface AddressEntryItem {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly icon: ReactNode;
  /** Absent for "Ask the agent", which sends the prompt as usual. */
  readonly run?: () => void | Promise<void>;
}

// Past this, text reads as a message: a few words at most, with no sentence punctuation.
const MAX_QUERY_LENGTH = 40;
const MAX_QUERY_WORDS = 4;
const MAX_MATCHES = 3;

/**
 * A new session's composer doubles as an address bar: a typed address opens as a page, other
 * short text can still be searched, and open tabs and pins that match are one key away.
 */
export function useAddressEntry(input: {
  readonly enabled: boolean;
  readonly prompt: string;
  readonly onOpenPage: (url: string) => void;
}) {
  const gt = useGT();
  const browserItems = useBrowserPaletteItems();
  const [highlight, setHighlight] = useState<{ prompt: string; index: number } | null>(null);
  const [dismissedPrompt, setDismissedPrompt] = useState<string | null>(null);
  const text = input.prompt.trim();
  const address = input.enabled ? addressFromText(text) : null;
  const visible =
    input.enabled &&
    text.length > 0 &&
    !input.prompt.includes("\n") &&
    dismissedPrompt !== input.prompt &&
    (address !== null || looksLikeQuery(text));

  const items: AddressEntryItem[] = [];
  if (visible) {
    const ask: AddressEntryItem = {
      id: "ask",
      label: text,
      description: gt("Ask the agent"),
      icon: <MessageSquareIcon className={ITEM_ICON_CLASS} />,
    };
    if (address !== null) {
      items.push(
        {
          id: "open",
          label: address.replace(/^https?:\/\//, "").replace(/\/$/, ""),
          description: gt("Open page"),
          icon: <GlobeIcon className={ITEM_ICON_CLASS} />,
          run: () => input.onOpenPage(address),
        },
        ask,
      );
    } else {
      items.push(ask, {
        id: "search",
        label: text,
        description: gt("Search the web"),
        icon: <SearchIcon className={ITEM_ICON_CLASS} />,
        run: () => input.onOpenPage(searchUrlFor(text)),
      });
    }
    const query = text.toLowerCase();
    for (const item of browserItems) {
      if (items.length >= 2 + MAX_MATCHES) break;
      if (!item.searchTerms.some((term) => term.toLowerCase().includes(query))) continue;
      items.push({
        id: item.value,
        label: typeof item.title === "string" ? item.title : (item.searchTerms[0] ?? ""),
        description: typeof item.description === "string" ? item.description : "",
        icon: item.icon,
        run: item.run,
      });
    }
  }

  const index =
    highlight !== null && highlight.prompt === input.prompt
      ? Math.min(highlight.index, items.length - 1)
      : 0;
  const move = (step: 1 | -1) =>
    setHighlight({ prompt: input.prompt, index: (index + step + items.length) % items.length });

  return {
    items,
    activeIndex: index,
    setActiveIndex: (next: number) => setHighlight({ prompt: input.prompt, index: next }),
    move,
    dismiss: () => setDismissedPrompt(input.prompt),
  };
}

/** Short, unpunctuated text could be a search or a tab name; anything longer is a message. */
function looksLikeQuery(text: string): boolean {
  return (
    text.length <= MAX_QUERY_LENGTH &&
    text.split(/\s+/).length <= MAX_QUERY_WORDS &&
    !/[?!.,;:]$/.test(text)
  );
}
