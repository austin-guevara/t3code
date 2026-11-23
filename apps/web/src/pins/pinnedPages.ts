import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import {
  type EnvironmentId,
  MAX_PINNED_PAGES,
  type PinnedPage,
  type ScopedThreadRef,
  ThreadId,
} from "@t3tools/contracts";

import { getClientSettings, updateClientSettings } from "~/hooks/useSettings";
import { randomUUID } from "~/lib/utils";

const PIN_THREAD_PREFIX = "pin-";

/** Each pin keeps its browser tab under a thread id of its own, so no session lists it. */
export function pinThreadRef(environmentId: EnvironmentId, pinId: string): ScopedThreadRef {
  return scopeThreadRef(environmentId, ThreadId.make(`${PIN_THREAD_PREFIX}${pinId}`));
}

export function pinIdFromThreadId(threadId: string): string | null {
  return threadId.startsWith(PIN_THREAD_PREFIX) ? threadId.slice(PIN_THREAD_PREFIX.length) : null;
}

/** The registrable part of a host, approximated by its last two labels. */
export function siteOf(url: string): string | null {
  const host = URL.parse(url)?.hostname;
  if (!host) return null;
  if (/^[\d.]+$/.test(host) || host.includes(":")) return host;
  return host.split(".").slice(-2).join(".");
}

export function isSameSite(a: string, b: string): boolean {
  const site = siteOf(a);
  return site !== null && site === siteOf(b);
}

export function pinLabel(pin: PinnedPage): string {
  return pin.title?.trim() || URL.parse(pin.url)?.hostname.replace(/^www\./, "") || pin.url;
}

function writePins(pins: ReadonlyArray<PinnedPage>) {
  return updateClientSettings({ pinnedPages: [...pins] });
}

/** Returns the new pin, or null when the pins are full. */
export function addPin(input: { url: string; title?: string | undefined }, at?: number) {
  const pins = getClientSettings().pinnedPages;
  if (pins.length >= MAX_PINNED_PAGES) return null;
  const pin: PinnedPage = {
    id: randomUUID().slice(0, 8),
    url: input.url,
    ...(input.title ? { title: input.title } : {}),
  };
  const next = [...pins];
  next.splice(at ?? next.length, 0, pin);
  void writePins(next);
  return pin;
}

export function removePin(id: string): { pin: PinnedPage; index: number } | null {
  const pins = getClientSettings().pinnedPages;
  const index = pins.findIndex((pin) => pin.id === id);
  if (index < 0) return null;
  void writePins(pins.filter((pin) => pin.id !== id));
  return { pin: pins[index]!, index };
}

export function restorePin(pin: PinnedPage, index: number) {
  const pins = getClientSettings().pinnedPages.filter((existing) => existing.id !== pin.id);
  pins.splice(Math.min(index, pins.length), 0, pin);
  void writePins(pins.slice(0, MAX_PINNED_PAGES));
}

/** Moves a pin so it lands before the pin now at `toIndex`. */
export function movePin(id: string, toIndex: number) {
  const pins = [...getClientSettings().pinnedPages];
  const from = pins.findIndex((pin) => pin.id === id);
  if (from < 0) return;
  const [pin] = pins.splice(from, 1);
  pins.splice(toIndex > from ? toIndex - 1 : toIndex, 0, pin!);
  void writePins(pins);
}
