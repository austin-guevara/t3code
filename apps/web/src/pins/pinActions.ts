import { MAX_PINNED_PAGES, type PreviewSessionSnapshot } from "@t3tools/contracts";
import { msg } from "gt-react";

import { toastManager } from "~/components/ui/toast";
import { getClientSettings } from "~/hooks/useSettings";
import { m } from "~/i18n/messages";

import { closePinBrowser } from "./pinBrowser";
import { addPin, pinLabel, removePin, restorePin } from "./pinnedPages";

export function pinsFull(): boolean {
  return getClientSettings().pinnedPages.length >= MAX_PINNED_PAGES;
}

export function pinnableUrl(snapshot: PreviewSessionSnapshot | undefined): string | null {
  if (!snapshot || snapshot.navStatus._tag === "Idle") return null;
  const url = snapshot.navStatus.url;
  return url.startsWith("http:") || url.startsWith("https:") ? url : null;
}

/**
 * Moves a browser tab into the pins. The caller closes the tab and shows the pin; Undo
 * calls `restore` to put the tab back.
 */
export function pinBrowserTab(input: {
  snapshot: PreviewSessionSnapshot;
  at?: number;
  onPinned: (pinId: string) => void;
  restore: () => void;
}): boolean {
  const url = pinnableUrl(input.snapshot);
  if (!url) return false;
  if (pinsFull()) {
    toastManager.add({ type: "info", title: m(msg("Pins are full. Unpin one first.")) });
    return false;
  }
  const title =
    input.snapshot.navStatus._tag === "Idle" ? undefined : input.snapshot.navStatus.title;
  const pin = addPin({ url, title }, input.at);
  if (!pin) return false;
  input.onPinned(pin.id);
  const id = toastManager.add({
    type: "success",
    title: m(msg("Pinned “{name}”", { name: pinLabel(pin) })),
    actionProps: {
      children: m(msg("Undo")),
      onClick: () => {
        toastManager.close(id);
        removePin(pin.id);
        void closePinBrowser(pin.id);
        input.restore();
      },
    },
  });
  return true;
}

export function unpinWithUndo(pinId: string, onUnpinned?: () => void) {
  const removed = removePin(pinId);
  if (!removed) return;
  onUnpinned?.();
  void closePinBrowser(pinId);
  const id = toastManager.add({
    type: "info",
    title: m(msg("Unpinned “{name}”", { name: pinLabel(removed.pin) })),
    actionProps: {
      children: m(msg("Undo")),
      onClick: () => {
        toastManager.close(id);
        restorePin(removed.pin, removed.index);
      },
    },
  });
}
