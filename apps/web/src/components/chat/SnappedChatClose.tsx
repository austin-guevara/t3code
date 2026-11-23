import type { ScopedThreadRef } from "@t3tools/contracts";
import { useGT } from "gt-react";
import { XIcon } from "lucide-react";
import { useEffect } from "react";
import { useRightPanelStore } from "../../rightPanelStore";
import { Button } from "../ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

/**
 * Selecting the chat tab of an empty chat docks it beside the page. Esc, or this button,
 * returns to full screen until the first message is sent.
 */
export function SnappedChatClose(props: { threadRef: ScopedThreadRef }) {
  const gt = useGT();
  const { threadRef } = props;
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- holds a window Escape listener while the chat is snapped
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const target = event.target instanceof Element ? event.target : null;
      if (!target?.closest("[data-chat-column]")) return;
      const editable = target.closest<HTMLElement>("[contenteditable='true'], textarea, input");
      const text = editable
        ? "value" in editable
          ? String((editable as HTMLInputElement).value)
          : editable.textContent
        : "";
      if (text?.trim()) return;
      if (useRightPanelStore.getState().unsnap(threadRef)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    // Capture: the composer handles Escape itself.
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [threadRef]);
  const label = gt("Close chat");
  return (
    <div className="pointer-events-none absolute top-[calc(var(--workspace-topbar-height)+0.5rem)] right-3 z-10">
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              aria-label={label}
              aria-keyshortcuts="Escape"
              className="pointer-events-auto"
              size="icon-xs"
              variant="ghost-muted"
              onClick={() => useRightPanelStore.getState().unsnap(threadRef)}
            >
              <XIcon />
            </Button>
          }
        />
        <TooltipPopup>{gt("Close chat (Esc)")}</TooltipPopup>
      </Tooltip>
    </div>
  );
}
