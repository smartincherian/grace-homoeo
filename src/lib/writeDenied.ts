export const WRITE_DENIED_EVENT = "homoeodesk:write-denied";

/** Tell the UI a write was refused by the rules (e.g. the trial ended). */
export function notifyWriteDenied(): void {
  window.dispatchEvent(new Event(WRITE_DENIED_EVENT));
}

/** Subscribe to write-denied notices; returns the unsubscribe function. */
export function onWriteDenied(cb: () => void): () => void {
  window.addEventListener(WRITE_DENIED_EVENT, cb);
  return () => window.removeEventListener(WRITE_DENIED_EVENT, cb);
}
