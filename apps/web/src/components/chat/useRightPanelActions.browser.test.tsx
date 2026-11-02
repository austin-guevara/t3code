import { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { expect, it } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { render } from "../../../test/render";
import { useDeviceState } from "../../state/device";
import { useThreadPreviewState } from "../../previewStateStore";
import { selectThreadRightPanelState, useRightPanelStore } from "../../rightPanelStore";
import { useChatShortcuts } from "./useChatShortcuts";
import { useRightPanelActions } from "./useRightPanelActions";

const threadRef = {
  environmentId: EnvironmentId.make("panel-shortcut-test"),
  threadId: ThreadId.make("closed-panel"),
};

function ClosedPanelChat() {
  const { shortcuts } = useRightPanelActions({
    activeThreadRef: threadRef,
    activeProject: null,
    activeRightPanelSurface: null,
    activePreviewState: useThreadPreviewState(null),
    deviceState: { ...useDeviceState(null).state, onboardingCompleted: true, hostStatus: "ready" },
    deviceStateLoaded: true,
    pullRequestPanelTarget: null,
    threadPanelPresentation: "inline",
    isServerThread: true,
    embedded: false,
    isGitRepo: false,
    browserAvailable: false,
    canOperatePreview: false,
    canOperateTerminal: false,
    onAddTerminal: () => {},
    diffOpen: false,
    previewPanelOpen: false,
    rightPanelOpen: false,
    canMaximizeRightPanel: true,
    rightPanelMaximized: false,
    supportsPullRequests: false,
    pullRequestsSurfaceAvailable: false,
    gitCwd: null,
    activeProjectCwd: null,
    explicitDiffOpenRef: { current: null },
    onDiffPanelOpen: undefined,
    closeRightPanelSurface: () => {},
  });
  useChatShortcuts({
    enabled: true,
    keybindings: [
      {
        command: "rightPanel.openDevice",
        shortcut: {
          key: "m",
          ctrlKey: true,
          shiftKey: true,
          metaKey: false,
          altKey: false,
          modKey: false,
        },
      },
    ],
    scriptKeybindings: [],
    getShortcutContext: () => ({
      terminalOpen: false,
      previewOpen: false,
      terminalFocus: false,
      previewFocus: false,
      isWeb: true,
      isDesktop: false,
      modelPickerOpen: false,
    }),
    threadFindActive: false,
    composerRef: { current: null },
    branchToolbarRef: { current: null },
    closeThreadFind: () => {},
    commands: shortcuts,
    fallback: () => undefined,
  });
  return null;
}

it("opens a surface through chat shortcuts while no panel is mounted", async () => {
  using cleanup = new DisposableStack();
  cleanup.defer(() => useRightPanelStore.getState().closeAllSurfaces(threadRef));
  const readPanel = () =>
    selectThreadRightPanelState(useRightPanelStore.getState().byThreadKey, threadRef);
  expect(readPanel().isOpen).toBe(false);
  // router: false because panel commands act on the local panel store without navigating.
  await using _screen = await render(<ClosedPanelChat />, { router: false });
  await userEvent.keyboard("{Control>}{Shift>}M{/Shift}{/Control}");
  expect(readPanel().isOpen).toBe(true);
  expect(readPanel().surfaces.map((surface) => surface.kind)).toEqual(["device"]);
});
