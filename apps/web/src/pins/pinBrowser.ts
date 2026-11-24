import { runAtomCommand } from "@t3tools/client-runtime/state/runtime";
import type {
  EnvironmentId,
  PinnedPage,
  PreviewCloseInput,
  PreviewOpenInput,
  ScopedThreadRef,
} from "@t3tools/contracts";

import { openUrlInPreview } from "~/browser/openFileInPreview";
import { closePreviewSession } from "~/components/preview/closePreviewSession";
import { useRightPanelStore } from "~/rightPanelStore";
import { openPreviewSession } from "~/components/preview/openPreviewSession";
import { readThreadPreviewState } from "~/previewStateStore";
import { appAtomRegistry } from "~/rpc/atomRegistry";
import { primaryEnvironmentIdAtom } from "~/state/primaryEnvironment";
import { previewEnvironment } from "~/state/preview";

import { pinThreadRef } from "./pinnedPages";

const openPreview = (input: { environmentId: EnvironmentId; input: PreviewOpenInput }) =>
  runAtomCommand(appAtomRegistry, previewEnvironment.open, input);
const closePreview = (input: { environmentId: EnvironmentId; input: PreviewCloseInput }) =>
  runAtomCommand(appAtomRegistry, previewEnvironment.close, input);

function readPinThreadRef(pinId: string): ScopedThreadRef | null {
  const environmentId = appAtomRegistry.get(primaryEnvironmentIdAtom);
  return environmentId ? pinThreadRef(environmentId, pinId) : null;
}

/** The page a pin is showing now, which can differ from the page it was pinned at. */
export function currentPinUrl(threadRef: ScopedThreadRef): string | null {
  const state = readThreadPreviewState(threadRef);
  const snapshot = state.activeTabId ? state.sessions[state.activeTabId] : undefined;
  return snapshot && snapshot.navStatus._tag !== "Idle" ? snapshot.navStatus.url : null;
}

export function openPinTab(threadRef: ScopedThreadRef, url: string) {
  return openPreviewSession({ openPreview, threadRef, url });
}

async function closePinTabs(threadRef: ScopedThreadRef, keepTabId?: string) {
  const { sessions } = readThreadPreviewState(threadRef);
  for (const tabId of Object.keys(sessions)) {
    if (tabId === keepTabId) continue;
    // No snapshot: a pin's old page is not a closed view to reopen.
    await closePreviewSession({ closePreview, snapshot: null, tabId, threadRef });
  }
}

/** Reloads the pinned page in a fresh tab, so the pin's history starts over. */
export async function returnPinHome(pin: PinnedPage) {
  const threadRef = readPinThreadRef(pin.id);
  if (!threadRef) return;
  const result = await openPinTab(threadRef, pin.url);
  if (result._tag === "Success") await closePinTabs(threadRef, result.value.tabId);
}

export async function closePinBrowser(pinId: string) {
  const threadRef = readPinThreadRef(pinId);
  if (threadRef) await closePinTabs(threadRef);
}

/** Opens a page in a session full screen, the way a page-first session starts. */
export async function openPageInSession(threadRef: ScopedThreadRef, url: string) {
  useRightPanelStore.getState().requestMaximize(threadRef);
  await openUrlInPreview({ threadRef, url, openPreview });
}
