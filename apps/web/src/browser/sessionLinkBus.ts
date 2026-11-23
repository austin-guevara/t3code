type Listener = (url: string) => void;

const listeners = new Set<Listener>();

/** Opens a link in a session of its own, the way a link from another app opens. */
export function openLinkInNewSession(url: string): boolean {
  const listener = [...listeners].at(-1);
  listener?.(url);
  return listener !== undefined;
}

export function onOpenLinkInNewSession(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
