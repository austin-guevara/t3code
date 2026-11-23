import { useAtomValue } from "@effect/atom-react";
import { useGT } from "gt-react";
import { useEffect, useRef } from "react";

import { PreviewPanel } from "~/components/preview/PreviewPanel";
import { usePreviewSession } from "~/components/preview/usePreviewSession";
import { SidebarInset } from "~/components/ui/sidebar";
import { WorkspacePageHeader } from "~/components/WorkspacePageHeader";
import { isElectron } from "~/env";
import { useClientSettings } from "~/hooks/useSettings";
import { useThreadPreviewState } from "~/previewStateStore";
import { primaryEnvironmentIdAtom } from "~/state/primaryEnvironment";

import { openPinTab } from "./pinBrowser";
import { pinLabel, pinThreadRef } from "./pinnedPages";

/** A pinned app fills the main area on its own, outside any session. */
export function PinnedPageView(props: { pinId: string }) {
  const gt = useGT();
  const pin = useClientSettings((settings) =>
    settings.pinnedPages.find((candidate) => candidate.id === props.pinId),
  );
  const environmentId = useAtomValue(primaryEnvironmentIdAtom);
  if (!pin || !environmentId) {
    return (
      <SidebarInset className="h-dvh min-h-0 overflow-hidden">
        <WorkspacePageHeader electron={isElectron} />
        <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
          {pin ? gt("Connecting…") : gt("This app is no longer pinned.")}
        </div>
      </SidebarInset>
    );
  }
  return <PinnedPageBrowser key={pin.id} pinId={pin.id} url={pin.url} label={pinLabel(pin)} />;
}

function PinnedPageBrowser(props: { pinId: string; url: string; label: string }) {
  const environmentId = useAtomValue(primaryEnvironmentIdAtom)!;
  const threadRef = pinThreadRef(environmentId, props.pinId);
  usePreviewSession(threadRef);
  const state = useThreadPreviewState(threadRef);
  const hasTab = Object.keys(state.sessions).length > 0;
  const openedRef = useRef(false);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- opens the pinned page once the server reports the pin has no tab
  useEffect(() => {
    if (!state.listLoaded || hasTab || openedRef.current) return;
    openedRef.current = true;
    void openPinTab(threadRef, props.url);
  }, [state.listLoaded, hasTab, threadRef, props.url]);
  return (
    <SidebarInset
      className="h-dvh min-h-0 overflow-hidden overscroll-y-none"
      data-pinned-page={props.pinId}
    >
      <WorkspacePageHeader electron={isElectron} className="bg-background">
        <h1 className="truncate text-sm font-medium">{props.label}</h1>
      </WorkspacePageHeader>
      <div className="flex min-h-0 flex-1 flex-col">
        <PreviewPanel mode="embedded" threadRef={threadRef} visible />
      </div>
    </SidebarInset>
  );
}
