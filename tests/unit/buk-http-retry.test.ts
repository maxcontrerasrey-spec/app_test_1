import { describe, expect, it, vi } from "vitest";
import { fetchBukWithRetry } from "../../scripts/lib/buk-http.mjs";

describe("BUK HTTP transient retry", () => {
  it("retries a 503 using Retry-After and then returns the successful response", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response("maintenance", { status: 503, headers: { "Retry-After": "2" } }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    const sleep = vi.fn().mockResolvedValue(undefined);

    const response = await fetchBukWithRetry("https://buk.example.test/areas", {}, {
      fetchImpl,
      sleep,
      random: () => 0.5,
    });

    expect(response.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(2000);
  });

  it("does not retry permanent client errors", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("unauthorized", { status: 401 }));
    const sleep = vi.fn();

    await expect(fetchBukWithRetry("https://buk.example.test/areas", {}, { fetchImpl, sleep }))
      .rejects.toThrow("status 401");

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("uses bounded exponential delay when Retry-After is absent", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    const sleep = vi.fn().mockResolvedValue(undefined);

    await fetchBukWithRetry("https://buk.example.test/areas", {}, {
      fetchImpl,
      sleep,
      random: () => 0.5,
    });

    expect(sleep.mock.calls.map(([delay]) => delay)).toEqual([1000, 2000]);
  });
});
