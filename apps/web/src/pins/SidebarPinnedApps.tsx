import { useAtomValue } from "@effect/atom-react";
import {
  type ContextMenuItem,
  type EnvironmentId,
  MAX_PINNED_PAGES,
  PIN_OPEN_KEYBINDING_COMMANDS,
  type PinnedPage,
} from "@t3tools/contracts";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useGT } from "gt-react";
import { PlusIcon } from "lucide-react";
import { type DragEvent, type MouseEvent, useEffect, useState } from "react";

import { FaviconImage } from "~/components/preview/PreviewFaviconIcon";
import { useFaviconForThreadUrl } from "~/browserFaviconStore";
import { useClientSettings } from "~/hooks/useSettings";
import { useStableCallback } from "~/hooks/useStableCallback";
import { shortcutLabelForCommand } from "~/keybindings";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";
import { readLocalApi } from "~/localApi";
import { registerCommands, registerMenuAction } from "~/shortcuts/dispatcher";
import { primaryEnvironmentIdAtom } from "~/state/primaryEnvironment";
import { primaryServerKeybindingsAtom } from "~/state/server";

import { currentPinUrl, returnPinHome } from "./pinBrowser";
import { unpinWithUndo } from "./pinActions";
import { usePinDropStore } from "./pinDropStore";
import { movePin, pinLabel, pinThreadRef } from "./pinnedPages";

const PIN_DRAG_TYPE = "application/x-t3-pin";

/** Rows hold at most four and stay balanced: five pins sit 3 and 2, eight sit 4 and 4. */
function columnsFor(count: number): number {
  return count === 4 || count === 7 || count === 8 || count >= 10 ? 4 : 3;
}

function usePinShortcuts(pins: ReadonlyArray<PinnedPage>, open: (pinId: string) => void) {
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- registers Ctrl+1-9 for the current pins
  useEffect(() => {
    const disposers = PIN_OPEN_KEYBINDING_COMMANDS.flatMap((command, index) => {
      const pin = pins[index];
      if (!pin) return [];
      return [
        registerCommands({
          [command]: (event: KeyboardEvent) => {
            if (!event.repeat) open(pin.id);
          },
        }),
        // A focused page forwards the chord as a menu action.
        registerMenuAction(command, () => open(pin.id)),
      ];
    });
    return () => {
      for (const dispose of disposers) dispose();
    };
  }, [pins, open]);
}

export function SidebarPinnedApps() {
  const gt = useGT();
  const pins = useClientSettings((settings) => settings.pinnedPages);
  const dragging = usePinDropStore((state) => state.dragging);
  const dropOver = usePinDropStore((state) => state.over);
  const environmentId = useAtomValue(primaryEnvironmentIdAtom);
  const keybindings = useAtomValue(primaryServerKeybindingsAtom);
  const navigate = useNavigate();
  const activePinId = useRouterState({
    select: (state) => /^\/pin\/([^/]+)/.exec(state.location.pathname)?.[1] ?? null,
  });
  const [reorder, setReorder] = useState<{ id: string; at: number | null } | null>(null);
  const open = useStableCallback(
    (pinId: string) => void navigate({ to: "/pin/$pinId", params: { pinId } }),
  );
  usePinShortcuts(pins, open);

  if (environmentId === null || (pins.length === 0 && !dragging)) return null;
  const showDrop = dragging && pins.length < MAX_PINNED_PAGES;
  const columns = columnsFor(pins.length + (showDrop ? 1 : 0));

  const showMenu = async (event: MouseEvent, pin: PinnedPage) => {
    event.preventDefault();
    const api = readLocalApi();
    if (!api) return;
    const pinRef = pinThreadRef(environmentId, pin.id);
    const current = currentPinUrl(pinRef);
    const items: ContextMenuItem<"home" | "unpin">[] = [];
    if (current && current !== pin.url) {
      items.push({ id: "home", label: gt("Back to pinned page") });
    }
    items.push({ id: "unpin", label: gt("Unpin") });
    const action = await api.contextMenu.show(items, { x: event.clientX, y: event.clientY });
    if (action === "home") {
      open(pin.id);
      void returnPinHome(pin);
    }
    if (action === "unpin") {
      unpinWithUndo(pin.id, () => {
        if (activePinId === pin.id) void navigate({ to: "/" });
      });
    }
  };

  const dropIndex = (event: DragEvent<HTMLElement>, index: number) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return event.clientX > rect.left + rect.width / 2 ? index + 1 : index;
  };

  return (
    <div
      role="group"
      aria-label={gt("Pinned apps")}
      data-pin-drop={showDrop ? "" : undefined}
      className="grid gap-1.5 pb-2"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {pins.map((pin, index) => {
        const label = pinLabel(pin);
        const shortcut =
          index < 9
            ? shortcutLabelForCommand(keybindings, PIN_OPEN_KEYBINDING_COMMANDS[index]!)
            : null;
        const indicator =
          reorder && reorder.id !== pin.id
            ? reorder.at === index
              ? "before"
              : reorder.at === index + 1
                ? "after"
                : null
            : null;
        return (
          <Tooltip key={pin.id}>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  draggable
                  aria-label={label}
                  aria-pressed={activePinId === pin.id}
                  data-pin={pin.id}
                  className={cn(
                    "relative flex h-10 w-full min-w-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground outline-none transition-colors hover:border-foreground/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                    "before:absolute before:inset-y-1 before:w-0.5 before:rounded-full before:bg-foreground before:opacity-0",
                    "aria-pressed:border-foreground/40 aria-pressed:text-foreground aria-pressed:shadow-xs",
                    reorder?.id === pin.id && "opacity-50",
                    indicator === "before" && "before:-left-1 before:opacity-100",
                    indicator === "after" && "before:-right-1 before:opacity-100",
                  )}
                  onClick={() => open(pin.id)}
                  onContextMenu={(event) => void showMenu(event, pin)}
                  onDragStart={(event) => {
                    event.dataTransfer.setData(PIN_DRAG_TYPE, pin.id);
                    event.dataTransfer.effectAllowed = "move";
                    setReorder({ id: pin.id, at: null });
                  }}
                  onDragOver={(event) => {
                    if (!reorder) return;
                    event.preventDefault();
                    const at = dropIndex(event, index);
                    if (reorder.at !== at) setReorder({ ...reorder, at });
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (reorder) movePin(reorder.id, dropIndex(event, index));
                    setReorder(null);
                  }}
                  onDragEnd={() => setReorder(null)}
                >
                  <PinIcon environmentId={environmentId} pin={pin} />
                </button>
              }
            />
            <TooltipPopup side="bottom">
              {label}
              {shortcut ? <span className="ms-2 text-muted-foreground">{shortcut}</span> : null}
            </TooltipPopup>
          </Tooltip>
        );
      })}
      {showDrop ? (
        <div
          aria-hidden
          className={cn(
            "flex h-10 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground",
            dropOver && "border-foreground bg-background text-foreground",
          )}
        >
          <PlusIcon className="size-3.5" />
        </div>
      ) : null}
    </div>
  );
}

function PinIcon(props: { environmentId: EnvironmentId; pin: PinnedPage }) {
  const favicon = useFaviconForThreadUrl(
    pinThreadRef(props.environmentId, props.pin.id),
    props.pin.url,
  );
  const letter = (
    <span
      aria-hidden
      className="flex size-[18px] items-center justify-center rounded-sm bg-muted text-3xs font-medium uppercase text-foreground"
    >
      {pinLabel(props.pin).slice(0, 1)}
    </span>
  );
  return <FaviconImage sources={[favicon]} fallback={letter} className="size-[18px] rounded-sm" />;
}
