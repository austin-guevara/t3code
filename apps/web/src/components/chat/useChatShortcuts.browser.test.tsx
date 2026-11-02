import {
  DEFAULT_CLIENT_SETTINGS,
  EnvironmentId,
  ThreadId,
  type ScopedThreadRef,
  type KeybindingCommand,
  type ResolvedKeybindingsConfig,
} from "@t3tools/contracts";
import { useEffect, useState } from "react";
import { expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";

import { DEFAULT_RESOLVED_KEYBINDINGS } from "@t3tools/shared/keybindings";
import { isMacPlatform } from "~/lib/utils";
import { RightPanelTabs } from "../RightPanelTabs";
import { surfaceShortcutKey } from "~/lib/surfaceShortcutKey";
import { act, render } from "../../../test/render";
import { AsyncResult } from "effect/reactivity";
import type { OpenPreviewMutation } from "../../browser/openFileInPreview";
import { __setClientSettingsForTests } from "../../hooks/useSettings";
import { startWorkspaceFocus } from "../../lib/workspaceFocus";

const mocks = vi.hoisted(() => ({ openPreview: vi.fn<OpenPreviewMutation<never>>() }));
vi.mock("../../state/use-atom-command", () => ({ useAtomCommand: () => mocks.openPreview }));
import type { ChatComposerHandle } from "./ChatComposer";
import { useChatShortcuts, type ChatShortcutCommands } from "./useChatShortcuts";
import { useRightPanelActions } from "./useRightPanelActions";
import { useDeviceState } from "../../state/device";
import { useThreadPreviewState } from "../../previewStateStore";
import { selectThreadRightPanelState, useRightPanelStore } from "../../rightPanelStore";

const shortcutContext = {
  terminalFocus: false,
  terminalOpen: false,
  previewFocus: false,
  previewOpen: false,
  isWeb: true,
  isDesktop: false,
  modelPickerOpen: false,
};

const focusOnMount = (element: HTMLElement | null) => element?.focus();

// Stands in for the right panel's launcher, which needs the whole app around it. Like the
// real one it takes focus, advertises its letters in `data-surface-launcher-keys`, and
// claims one from its own window capture listener unless the key was already handled.
function Launcher(props: { keys: string; received: string[] }) {
  useEffect(() => {
    const claim = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const key = surfaceShortcutKey(event);
      if (key === null || !props.keys.toLowerCase().includes(key)) return;
      event.preventDefault();
      props.received.push(event.key);
    };
    window.addEventListener("keydown", claim, true);
    return () => window.removeEventListener("keydown", claim, true);
  }, [props.keys, props.received]);
  return (
    <div
      ref={focusOnMount}
      tabIndex={0}
      aria-label="Open a surface"
      data-surface-launcher-keys={props.keys}
    />
  );
}

// The chat's shortcut listener registers when the chat mounts, so a launcher that opens
// later registers after it. Tests mount the chat first and add the launcher by rerendering.
function Chat(props: {
  composerKeys: string[];
  launcher?: { keys: string; received: string[] };
  keybindings?: ResolvedKeybindingsConfig;
  commands?: ChatShortcutCommands;
}) {
  useChatShortcuts({
    enabled: true,
    keybindings: props.keybindings ?? [],
    scriptKeybindings: [],
    getShortcutContext: () => shortcutContext,
    threadFindActive: false,
    // Type-to-focus only calls insertTextAtEnd, so the stand-in composer implements just that.
    composerRef: {
      current: {
        insertTextAtEnd: (key: string) => {
          props.composerKeys.push(key);
          return true;
        },
      } as Partial<ChatComposerHandle> as ChatComposerHandle,
    },
    branchToolbarRef: { current: null },
    closeThreadFind: () => {},
    commands: props.commands ?? {},
    fallback: () => undefined,
  });
  return props.launcher ? <Launcher {...props.launcher} /> : null;
}

// router: false because the chat shortcuts and the launcher stand-in never navigate.
const options = { router: false } as const;

it("leaves the launcher's letters to the launcher, in either case", async () => {
  const composerKeys: string[] = [];
  const received: string[] = [];
  await using screen = await render(<Chat composerKeys={composerKeys} />, options);
  await screen.rerender(<Chat composerKeys={composerKeys} launcher={{ keys: "BT", received }} />);

  await userEvent.keyboard("tT");

  expect(received).toEqual(["t", "T"]);
  expect(composerKeys).toEqual([]);
});

it("still types other letters into the composer while the launcher is open", async () => {
  const composerKeys: string[] = [];
  const received: string[] = [];
  await using screen = await render(<Chat composerKeys={composerKeys} />, options);
  await screen.rerender(<Chat composerKeys={composerKeys} launcher={{ keys: "BT", received }} />);

  await userEvent.keyboard("a");

  expect(composerKeys).toEqual(["a"]);
  expect(received).toEqual([]);
});

it("leaves a non-Latin launcher letter to the launcher by its physical key", async () => {
  const composerKeys: string[] = [];
  const received: string[] = [];
  await using screen = await render(<Chat composerKeys={composerKeys} />, options);
  await screen.rerender(<Chat composerKeys={composerKeys} launcher={{ keys: "BT", received }} />);

  // Playwright cannot press a key its US layout lacks, so send what a Ukrainian T key sends.
  const event = new KeyboardEvent("keydown", {
    key: "\u0435",
    code: "KeyT",
    bubbles: true,
    cancelable: true,
  });
  (document.activeElement ?? document.body).dispatchEvent(event);

  expect(composerKeys).toEqual([]);
  expect(received).toEqual(["\u0435"]);
});

it.each([
  { key: "b", code: "KeyN", composer: [], launcher: ["b"] },
  { key: "x", code: "KeyB", composer: ["x"], launcher: [] },
  { key: "è", code: "KeyT", composer: ["è"], launcher: [] },
])("routes $key on $code by the typed letter", async ({ key, code, composer, launcher }) => {
  const composerKeys: string[] = [];
  const received: string[] = [];
  await using screen = await render(<Chat composerKeys={composerKeys} />, options);
  await screen.rerender(<Chat composerKeys={composerKeys} launcher={{ keys: "BT", received }} />);

  const event = new KeyboardEvent("keydown", { key, code, bubbles: true, cancelable: true });
  (document.activeElement ?? document.body).dispatchEvent(event);

  expect(composerKeys).toEqual(composer);
  expect(received).toEqual(launcher);
});

const ctrlShift = (key: string, command: KeybindingCommand) => ({
  command,
  shortcut: { key, metaKey: false, ctrlKey: true, shiftKey: true, altKey: false, modKey: false },
});
const sideChatKeybindings: ResolvedKeybindingsConfig = [
  ctrlShift("m", "modelPicker.toggle"),
  ctrlShift("x", "thread.stop"),
];

// A side chat in the main chat's panel: no window listeners, only its composer's own chords.
function SideChat(props: { toggles: string[]; stops: string[] }) {
  const [composerElement, setComposerElement] = useState<HTMLDivElement | null>(null);
  useChatShortcuts({
    enabled: false,
    embedded: true,
    composerElement,
    keybindings: sideChatKeybindings,
    scriptKeybindings: [],
    getShortcutContext: () => shortcutContext,
    threadFindActive: false,
    composerRef: {
      current: {
        toggleModelPicker: () => props.toggles.push("model"),
      } as Partial<ChatComposerHandle> as ChatComposerHandle,
    },
    branchToolbarRef: { current: null },
    closeThreadFind: () => {},
    commands: { "thread.stop": () => void props.stops.push("stop") },
    fallback: () => undefined,
  });
  return (
    <>
      <div ref={setComposerElement}>
        <textarea aria-label="Side chat composer" />
      </div>
      <textarea aria-label="Main composer" />
    </>
  );
}

it("runs a side chat's composer chords only from its composer, and never thread commands", async () => {
  const toggles: string[] = [];
  const stops: string[] = [];
  await using screen = await render(<SideChat toggles={toggles} stops={stops} />, options);

  await userEvent.click(screen.getByLabelText("Side chat composer"));
  await userEvent.keyboard("{Control>}{Shift>}MX{/Shift}{/Control}");
  await userEvent.click(screen.getByLabelText("Main composer"));
  await userEvent.keyboard("{Control>}{Shift>}M{/Shift}{/Control}");

  expect(toggles).toEqual(["model"]);
  expect(stops).toEqual([]);
});

function ClosedPanelChat({
  threadRef,
  browser = false,
  newTab = false,
}: {
  threadRef: ScopedThreadRef;
  browser?: boolean;
  newTab?: boolean;
}) {
  const panel = useRightPanelStore((state) =>
    selectThreadRightPanelState(state.byThreadKey, threadRef),
  );
  const panelOpen = panel.isOpen;
  const actions = useRightPanelActions({
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
    browserAvailable: browser,
    canOperatePreview: browser,
    canOperateTerminal: false,
    onAddTerminal: () => {},
    diffOpen: false,
    previewPanelOpen: false,
    rightPanelOpen: panelOpen,
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
  return (
    <>
      <Chat
        composerKeys={[]}
        commands={actions.shortcuts}
        keybindings={
          newTab
            ? DEFAULT_RESOLVED_KEYBINDINGS
            : [ctrlShift("m", browser ? "rightPanel.openBrowser" : "rightPanel.openDevice")]
        }
      />
      {newTab && panelOpen ? (
        <RightPanelTabs
          mode="inline"
          open
          newSurfaceMenu={actions.newSurfaceMenu}
          keybindings={DEFAULT_RESOLVED_KEYBINDINGS}
          getShortcutContext={() => shortcutContext}
          surfaces={panel.surfaces}
          environmentId={threadRef.environmentId}
          activeSurfaceId={panel.activeSurfaceId}
          pendingSurfaceIds={new Set()}
          previewSessions={{}}
          desktopByTabId={{}}
          terminalLabelsById={new Map()}
          onActivate={actions.activateRightPanelSurfaceStable}
          onCloseSurface={() => {}}
          onCloseOtherSurfaces={() => {}}
          onCloseSurfacesToRight={() => {}}
          onCloseAllSurfaces={() => useRightPanelStore.getState().closeAllSurfaces(threadRef)}
          onCopyFilePath={actions.copyRightPanelFilePathStable}
          onAddBrowser={() => actions.createBrowserSurface()}
          onAddBrowserInProfile={actions.createBrowserSurfaceStable}
          onAddTerminal={() => {}}
          onAddDiff={actions.addDiffSurfaceStable}
          onAddFiles={actions.addFilesSurfaceStable}
          onAddPullRequest={actions.addPullRequestSurfaceStable}
          onAddPullRequests={actions.addPullRequestsSurfaceStable}
          onAddDevice={actions.addDeviceSurfaceStable}
          browserAvailable={false}
          terminalAvailable={false}
          diffAvailable={false}
          filesAvailable={false}
          pullRequestAvailable={false}
          pullRequestsAvailable={false}
          deviceAvailable
        >
          {null}
        </RightPanelTabs>
      ) : null}
      {browser && panelOpen ? (
        <section data-workspace-area="panel" tabIndex={-1}>
          <button data-workspace-focus-default>Browser tab</button>
          <input aria-label="Browser URL" data-workspace-focus-default data-preview-url-input />
        </section>
      ) : null}
    </>
  );
}

it("opens a surface through chat shortcuts while no panel is mounted", async () => {
  const threadRef = {
    environmentId: EnvironmentId.make("panel-shortcut-test"),
    threadId: ThreadId.make("closed-panel"),
  };
  using cleanup = new DisposableStack();
  cleanup.defer(() => useRightPanelStore.getState().closeAllSurfaces(threadRef));
  const readPanel = () =>
    selectThreadRightPanelState(useRightPanelStore.getState().byThreadKey, threadRef);
  expect(readPanel().isOpen).toBe(false);
  // router: false because panel commands act on the local panel store without navigating.
  await using _screen = await render(<ClosedPanelChat threadRef={threadRef} />, { router: false });
  await userEvent.keyboard("{Control>}{Shift>}M{/Shift}{/Control}");
  expect(readPanel().isOpen).toBe(true);
  expect(readPanel().surfaces.map((surface) => surface.kind)).toEqual(["device"]);
});

it("focuses the URL after asynchronous browser creation opens the panel", async () => {
  const threadRef = {
    environmentId: EnvironmentId.make("panel-shortcut-test"),
    threadId: ThreadId.make("browser-focus"),
  };
  __setClientSettingsForTests(DEFAULT_CLIENT_SETTINGS);
  let resolveOpening!: (value: Awaited<ReturnType<OpenPreviewMutation<never>>>) => void;
  const opening = new Promise<Awaited<ReturnType<OpenPreviewMutation<never>>>>((resolve) => {
    resolveOpening = resolve;
  });
  mocks.openPreview.mockReset().mockReturnValue(opening);
  await using screen = await render(<ClosedPanelChat threadRef={threadRef} browser />);
  using cleanup = new DisposableStack();
  cleanup.defer(startWorkspaceFocus(screen.router!));
  cleanup.defer(() => useRightPanelStore.getState().closeAllSurfaces(threadRef));
  await userEvent.keyboard("{Control>}{Shift>}M{/Shift}{/Control}");
  await vi.waitFor(() => expect(mocks.openPreview).toHaveBeenCalledOnce());
  await act(() =>
    resolveOpening(
      AsyncResult.success({
        threadId: threadRef.threadId,
        tabId: "new-browser",
        navStatus: { _tag: "Idle" },
        canGoBack: false,
        canGoForward: false,
        updatedAt: "2026-11-02T00:00:00.000Z",
      }),
    ),
  );
  await expect.element(screen.getByRole("textbox", { name: "Browser URL" })).toHaveFocus();
});

it("opens the new-tab menu from a closed panel and preserves its letter shortcuts", async () => {
  __setClientSettingsForTests(DEFAULT_CLIENT_SETTINGS);
  const threadRef = {
    environmentId: EnvironmentId.make("panel-shortcut-test"),
    threadId: ThreadId.make("new-tab-menu"),
  };
  await using _screen = await render(<ClosedPanelChat threadRef={threadRef} newTab />);
  using cleanup = new DisposableStack();
  cleanup.defer(() => useRightPanelStore.getState().closeAllSurfaces(threadRef));
  const readPanel = () =>
    selectThreadRightPanelState(useRightPanelStore.getState().byThreadKey, threadRef);
  const newTabShortcut = isMacPlatform(navigator.platform)
    ? "{Meta>}t{/Meta}"
    : "{Control>}t{/Control}";
  expect(readPanel().isOpen).toBe(false);
  await userEvent.keyboard(newTabShortcut);
  await expect.element(page.getByRole("menu")).toBeVisible();
  expect(readPanel().surfaces).toEqual([]);
  await userEvent.keyboard("m");
  expect(readPanel().surfaces.map((surface) => surface.kind)).toEqual(["device"]);
  await act(() => useRightPanelStore.getState().close(threadRef));
  await userEvent.keyboard(newTabShortcut);
  await expect.element(page.getByRole("menu")).toBeVisible();
  expect(readPanel().isOpen).toBe(true);
  await userEvent.keyboard("{Escape}");
  await expect.element(page.getByRole("menu")).not.toBeInTheDocument();
});
