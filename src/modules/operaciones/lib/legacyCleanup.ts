const LEGACY_DRAFT_PREFIX = "operations:base-register:draft:";

/** Removes browser-only drafts from the retired Operations workflow; Atlas Ops never imports them. */
export function purgeLegacyOperationsDrafts(storage: Pick<Storage, "length" | "key" | "removeItem"> | undefined = typeof window === "undefined" ? undefined : window.localStorage) {
  if (!storage) return;
  for (let index = storage.length - 1; index >= 0; index -= 1) {
    const key = storage.key(index);
    if (key?.startsWith(LEGACY_DRAFT_PREFIX)) storage.removeItem(key);
  }
}
