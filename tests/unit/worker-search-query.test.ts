import { afterEach, describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import {
  createWorkerSearchQueryOptions,
  normalizeRutAwareWorkerSearchTerm,
  normalizeWorkerSearchTerm
} from "../../src/shared/lib/workerSearch";

describe("shared BUK worker search policy", () => {
  let queryClient: QueryClient | undefined;

  afterEach(() => {
    queryClient?.clear();
    queryClient = undefined;
  });

  it("normalizes accents, case and repeated whitespace like the database helper", () => {
    expect(normalizeWorkerSearchTerm("  José   Muñoz  ")).toBe("jose munoz");
  });

  it("canonicalizes formatted RUTs, including a K check digit, to the synced digit projection", () => {
    expect(normalizeRutAwareWorkerSearchTerm("15.573.108-K")).toBe("15573108");
    expect(normalizeRutAwareWorkerSearchTerm("14.436.142-3")).toBe("144361423");
    expect(normalizeRutAwareWorkerSearchTerm("José   Muñoz")).toBe("jose munoz");
  });

  it("uses the same accent-insensitive query key for names with or without tildes", () => {
    expect(normalizeRutAwareWorkerSearchTerm("  José   Muñoz  ")).toBe("jose munoz");
    expect(normalizeRutAwareWorkerSearchTerm("Jose Munoz")).toBe("jose munoz");
    expect(normalizeRutAwareWorkerSearchTerm("15.573.108-K")).toBe("15573108");
  });

  it("reuses the cached search only when the module scope is the same", async () => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });
    const calls: string[] = [];
    const options = (scope: string, search: string) =>
      createWorkerSearchQueryOptions({
        search,
        queryKey: (normalizedSearch) => [scope, "worker-search", normalizedSearch],
        query: async (normalizedSearch) => {
          calls.push(`${scope}:${normalizedSearch}`);
          return [`${scope}:${normalizedSearch}`];
        }
      });

    await queryClient.fetchQuery(options("roster", "José   Muñoz"));
    await queryClient.fetchQuery(options("roster", "jose munoz"));
    await queryClient.fetchQuery(options("incentives", "jose munoz"));

    expect(calls).toEqual(["roster:jose munoz", "incentives:jose munoz"]);
  });

  it("aborts the network query when a newer search replaces it", async () => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });
    let observedSignal: AbortSignal | undefined;
    let markRequestStarted: (() => void) | undefined;
    const requestStarted = new Promise<void>((resolve) => {
      markRequestStarted = resolve;
    });
    const options = createWorkerSearchQueryOptions({
      search: "mar",
      queryKey: (normalizedSearch) => ["roster", "worker-search", normalizedSearch],
      query: (_normalizedSearch, signal) => new Promise<never>((_resolve) => {
        observedSignal = signal;
        markRequestStarted?.();
        signal.addEventListener("abort", () => undefined, { once: true });
      })
    });
    const request = queryClient.fetchQuery(options).catch(() => undefined);

    await requestStarted;
    await queryClient.cancelQueries({ queryKey: options.queryKey });
    await request;

    expect(observedSignal?.aborted).toBe(true);
  });

  it("keeps a scope key on the options so auth domains cannot share a worker result", () => {
    const roster = createWorkerSearchQueryOptions({
      search: "maria",
      queryKey: (normalizedSearch) => ["roster", "worker-search", normalizedSearch],
      query: async () => []
    });
    const sanctions = createWorkerSearchQueryOptions({
      search: "maria",
      queryKey: (normalizedSearch) => ["sanctions", "worker-search", normalizedSearch],
      query: async () => []
    });

    expect(sanctions.queryKey).not.toEqual(roster.queryKey);
  });
});
