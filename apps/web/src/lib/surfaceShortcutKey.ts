type SurfaceKeyEvent = Pick<KeyboardEvent, "key"> &
  Partial<Pick<KeyboardEvent, "code" | "getModifierState">>;

export function surfaceShortcutKey(event: SurfaceKeyEvent): string | null {
  // AltGr text must stay text even when the browser omits Ctrl and Alt.
  if (event.getModifierState?.("AltGraph") && !/^[a-z0-9]$/i.test(event.key)) return null;
  const typed = event.key.toLowerCase();
  // Preserve Latin layouts, punctuation and dead keys; non-Latin letters/marks use the physical key.
  const physical =
    /^[\p{L}\p{M}]+$/u.test(typed) && !/\p{Script=Latin}/u.test(typed)
      ? event.code?.match(/^Key([A-Z])$/)?.[1]?.toLowerCase()
      : undefined;
  return physical ?? typed;
}

// Closed keepMounted popups must stop blocking shortcuts once their exit transition ends.
export const LAUNCHER_SHORTCUT_BLOCKING_LAYERS = [
  "dialog-popup",
  "alert-dialog-popup",
  "command-dialog-popup",
  "menu-popup",
  "select-popup",
  "popover-popup",
  "combobox-popup",
  "autocomplete-popup",
]
  .map((slot) => `[data-slot="${slot}"]:is([data-open],[data-ending-style])`)
  .join(",");
