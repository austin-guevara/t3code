import { create } from "zustand";

/**
 * A browser tab dragged out of the tab strip can be dropped on the sidebar's pins. The tab
 * strip owns the drag; the pins only show where it would land.
 */
export const usePinDropStore = create<{ dragging: boolean; over: boolean }>(() => ({
  dragging: false,
  over: false,
}));

const PIN_DROP_SELECTOR = "[data-pin-drop]";

export function isOverPinDrop(x: number, y: number): boolean {
  return document.elementFromPoint(x, y)?.closest(PIN_DROP_SELECTOR) != null;
}
