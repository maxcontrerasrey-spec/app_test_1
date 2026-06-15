import { lazy, type ComponentType, type LazyExoticComponent } from "react";

const RETRY_STORAGE_PREFIX = "app:lazy-retry";

export function isChunkLoadError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  const name = error.name.toLowerCase();

  return (
    name.includes("chunkloaderror") ||
    message.includes("failed to fetch dynamically imported module") ||
    message.includes("importing a module script failed") ||
    message.includes("loading chunk") ||
    message.includes("dynamically imported module")
  );
}

export function lazyWithRetry<T extends ComponentType<any>>(
  cacheKey: string,
  importer: () => Promise<{ default: T }>
): LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      const module = await importer();

      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(`${RETRY_STORAGE_PREFIX}:${cacheKey}`);
      }

      return module;
    } catch (error) {
      if (typeof window === "undefined" || !isChunkLoadError(error)) {
        throw error;
      }

      const storageKey = `${RETRY_STORAGE_PREFIX}:${cacheKey}`;
      const hasRetried = window.sessionStorage.getItem(storageKey) === "1";

      if (!hasRetried) {
        window.sessionStorage.setItem(storageKey, "1");
        window.location.reload();
        return new Promise<never>(() => {
          // The page is reloading. Keep the promise pending to avoid secondary crashes.
        });
      }

      window.sessionStorage.removeItem(storageKey);
      throw error;
    }
  });
}
