import type { ScopedThreadRef } from "@t3tools/contracts";
import { scopedThreadKey } from "@t3tools/client-runtime/environment";
import type { UseNavigateResult } from "@tanstack/react-router";

import { useComposerDraftStore } from "~/composerDraftStore";
import { readThreadPreviewState } from "~/previewStateStore";
import { useRightPanelStore } from "~/rightPanelStore";
import { buildThreadRouteParams } from "~/threadRoutes";

/** The draft, if any, a thread id still belongs to. */
export function draftIdForThread(threadRef: ScopedThreadRef): string | null {
  const drafts = useComposerDraftStore.getState().draftThreadsByThreadKey;
  for (const [draftId, session] of Object.entries(drafts)) {
    if (session.promotedTo != null) continue;
    if (
      session.threadId === threadRef.threadId &&
      session.environmentId === threadRef.environmentId
    )
      return draftId;
  }
  return null;
}

/** Shows a session, whether it is still a draft or already a thread. */
export function navigateToSession(navigate: UseNavigateResult<string>, threadRef: ScopedThreadRef) {
  const draftId = draftIdForThread(threadRef);
  return draftId !== null
    ? navigate({ to: "/draft/$draftId", params: { draftId } })
    : navigate({ to: "/$environmentId/$threadId", params: buildThreadRouteParams(threadRef) });
}

/** Whether a session keeps browser tabs, which make a draft worth keeping like typed text does. */
export function threadHoldsBrowserTabs(threadRef: ScopedThreadRef): boolean {
  const panel = useRightPanelStore.getState().byThreadKey[scopedThreadKey(threadRef)];
  if (panel?.surfaces.some((surface) => surface.kind === "preview" && surface.resourceId)) {
    return true;
  }
  return Object.keys(readThreadPreviewState(threadRef).sessions).length > 0;
}
