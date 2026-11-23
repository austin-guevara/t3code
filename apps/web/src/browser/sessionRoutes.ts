import type { ScopedThreadRef } from "@t3tools/contracts";
import type { UseNavigateResult } from "@tanstack/react-router";

import { useComposerDraftStore } from "~/composerDraftStore";
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
