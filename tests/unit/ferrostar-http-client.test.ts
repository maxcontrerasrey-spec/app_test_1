import { describe, expect, it, vi } from "vitest";
import { createValhallaHttpClient } from "../../src/modules/operaciones/lib/ferrostarHttpClient";

describe("Ferrostar Valhalla HTTP client", () => {
  it("declares JSON when Ferrostar sends its encoded route request", async () => {
    const fetcher = vi.fn(async () => new Response("{}", { status: 200 }));
    const client = createValhallaHttpClient(fetcher);

    await client("https://valhalla.example/route", { method: "POST", body: new ArrayBuffer(2) });

    expect(fetcher).toHaveBeenCalledOnce();
    const [, init] = fetcher.mock.calls[0]!;
    expect(new Headers(init?.headers).get("content-type")).toBe("application/json");
  });

  it("preserves an explicitly provided content type", async () => {
    const fetcher = vi.fn(async () => new Response("{}", { status: 200 }));
    const client = createValhallaHttpClient(fetcher);

    await client("https://valhalla.example/route", { method: "POST", headers: { "content-type": "application/vnd.valhalla+json" }, body: "{}" });

    const [, init] = fetcher.mock.calls[0]!;
    expect(new Headers(init?.headers).get("content-type")).toBe("application/vnd.valhalla+json");
  });

  it("keeps the provider validation message available for diagnosis", async () => {
    const client = createValhallaHttpClient(async () => new Response(JSON.stringify({ error: "Invalid route locations" }), { status: 400 }));

    await expect(client("https://valhalla.example/route", { method: "POST", body: "{}" })).rejects.toThrow("Valhalla respondió HTTP 400: Invalid route locations.");
  });
});
