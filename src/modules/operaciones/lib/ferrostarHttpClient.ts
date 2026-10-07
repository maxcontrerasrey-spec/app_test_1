export type FerrostarFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/** Ensures Ferrostar's generated JSON request reaches Valhalla with its declared content type. */
export function createValhallaHttpClient(fetcher: FerrostarFetch = fetch): FerrostarFetch {
  return async (input, init) => {
    const headers = new Headers(init?.headers);
    if (init?.body != null && !headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }

    const response = await fetcher(input, { ...init, headers });
    if (response.ok) return response;

    let providerMessage = "";
    try {
      const payload = await response.clone().json() as { error?: unknown; message?: unknown };
      const detail = [payload.error, payload.message].find((value): value is string => typeof value === "string" && value.trim().length > 0);
      if (detail) providerMessage = `: ${detail.trim().replace(/[\u0000-\u001f]+/g, " ").slice(0, 180)}`;
    } catch {
      // Preserve the HTTP status if Valhalla returns a non-JSON proxy error.
    }
    throw new Error(`Valhalla respondió HTTP ${response.status}${providerMessage}.`);
  };
}
