import { parseScopedThreadKey } from "@t3tools/client-runtime/environment";
import { PIN_OPEN_KEYBINDING_COMMANDS } from "@t3tools/contracts";
import { useNavigate } from "@tanstack/react-router";
import { useGT } from "gt-react";
import { GlobeIcon, PinIcon } from "lucide-react";

import { navigateToSession } from "~/browser/sessionRoutes";
import { ITEM_ICON_CLASS, type CommandPaletteActionItem } from "~/components/CommandPalette.logic";
import { useClientSettings } from "~/hooks/useSettings";
import { useActivePreviewSessions } from "~/previewStateStore";
import { useRightPanelStore } from "~/rightPanelStore";
import { readThreadShell } from "~/state/entities";

import { pinIdFromThreadId, pinLabel } from "./pinnedPages";

function hostOf(url: string): string {
  return URL.parse(url)?.hostname.replace(/^www\./, "") ?? url;
}

/** Pinned apps and every open browser tab, for the command palette's search. */
export function useBrowserPaletteItems(): CommandPaletteActionItem[] {
  const gt = useGT();
  const navigate = useNavigate();
  const pins = useClientSettings((settings) => settings.pinnedPages);
  const sessions = useActivePreviewSessions();

  const pinItems = pins.map((pin, index): CommandPaletteActionItem => ({
    kind: "action",
    value: `pin:${pin.id}`,
    searchTerms: [pinLabel(pin), pin.url],
    title: pinLabel(pin),
    description: gt("Pinned"),
    icon: <PinIcon className={ITEM_ICON_CLASS} />,
    ...(index < PIN_OPEN_KEYBINDING_COMMANDS.length
      ? { shortcutCommand: PIN_OPEN_KEYBINDING_COMMANDS[index] }
      : {}),
    run: async () => {
      await navigate({ to: "/pin/$pinId", params: { pinId: pin.id } });
    },
  }));

  const tabItems = Object.entries(sessions).flatMap(([threadKey, state]) => {
    const threadRef = parseScopedThreadKey(threadKey);
    if (!threadRef || pinIdFromThreadId(threadRef.threadId) !== null) return [];
    const session = readThreadShell(threadRef)?.title ?? gt("New session");
    return Object.values(state.sessions).flatMap((snapshot): CommandPaletteActionItem[] => {
      if (snapshot.navStatus._tag === "Idle") return [];
      const { url, title } = snapshot.navStatus;
      const label = title?.trim() || hostOf(url);
      return [
        {
          kind: "action",
          value: `tab:${threadKey}:${snapshot.tabId}`,
          searchTerms: [label, url, session],
          title: label,
          description: gt("Tab · {session}", { session }),
          icon: <GlobeIcon className={ITEM_ICON_CLASS} />,
          run: async () => {
            useRightPanelStore.getState().openBrowser(threadRef, snapshot.tabId);
            await navigateToSession(navigate, threadRef);
          },
        },
      ];
    });
  });

  return [...pinItems, ...tabItems];
}
