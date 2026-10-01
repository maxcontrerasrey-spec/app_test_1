import { afterEach, describe, expect, it, vi } from "vitest";
import { onRequest } from "../../functions/api/atlas/telemetry/ingest";

const TOKEN = "t".repeat(48);
const position = {
  external_event_id: "event-1",
  external_vehicle_id: "device-1",
  observed_at: "2026-09-30T12:15:00-03:00",
  latitude: -22.4544,
  longitude: -68.9294,
  speed_kph: 42,
  heading_degrees: 180,
  ignition: true,
  odometer_km: 12345,
  accuracy_m: 8,
  event_type: "position"
};

function environment() {
  const objects = new Map<string, ArrayBuffer>();
  const head = vi.fn(async (key: string) => objects.has(key) ? { key } : null);
  const put = vi.fn(async (key: string, value: ArrayBuffer) => { objects.set(key, value); });
  const env = {
    ATLAS_TRACKTEC_INGEST_TOKEN: TOKEN,
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "server-only-test-key",
    R2_BUCKET: { head, put }
  };
  return { env, objects, head, put };
}

function context(request: Request, env: ReturnType<typeof environment>["env"]) {
  return { request, env } as never;
}

afterEach(() => vi.restoreAllMocks());

describe("Atlas TrackTec server ingestion endpoint", () => {
  it("rejects missing credentials before storing or calling Supabase", async () => {
    const state = environment();
    const response = await onRequest(context(new Request("https://erp.test/api/atlas/telemetry/ingest", { method: "POST", body: JSON.stringify({ events: [position] }) }), state.env));

    expect(response.status).toBe(401);
    expect(state.head).not.toHaveBeenCalled();
    expect(state.put).not.toHaveBeenCalled();
  });

  it("archives one normalized batch and calls privileged ingest then cleanup", async () => {
    const state = environment();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/atlas_ops_ingest_tracktec_positions")) return new Response(JSON.stringify({ inserted: 1, unmatched: 0 }), { status: 200 });
      if (url.endsWith("/atlas_ops_purge_archived_telemetry")) return new Response("1", { status: 200 });
      return new Response("not found", { status: 404 });
    });
    const request = new Request("https://erp.test/api/atlas/telemetry/ingest", {
      method: "POST",
      headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify({ events: [position] })
    });

    const response = await onRequest(context(request, state.env));
    const result = await response.json() as Record<string, unknown>;
    const object = [...state.objects.values()][0];
    const uncompressed = await new Response(new Blob([object]).stream().pipeThrough(new DecompressionStream("gzip"))).text();

    expect(response.status).toBe(202);
    expect(result).toMatchObject({ accepted: 1, inserted: 1, unmatched: 0, archive: "stored" });
    expect(uncompressed).toBe(`${JSON.stringify({ ...position, observed_at: "2026-09-30T15:15:00.000Z" })}\n`);
    expect(state.put).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(String(fetchSpy.mock.calls[0][0])).toContain("atlas_ops_ingest_tracktec_positions");
    expect(String(fetchSpy.mock.calls[1][0])).toContain("atlas_ops_purge_archived_telemetry");
  });

  it("reuses the content-addressed archive when TrackTec retries the same batch", async () => {
    const state = environment();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ inserted: 1, unmatched: 0 }), { status: 200 }));
    const makeRequest = () => new Request("https://erp.test/api/atlas/telemetry/ingest", {
      method: "POST",
      headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify({ events: [position] })
    });

    const first = await onRequest(context(makeRequest(), state.env));
    const second = await onRequest(context(makeRequest(), state.env));

    expect(first.status).toBe(202);
    expect(second.status).toBe(202);
    expect(state.put).toHaveBeenCalledTimes(1);
    expect(state.head).toHaveBeenCalledTimes(2);
    expect(fetchSpy).toHaveBeenCalledTimes(4);
  });

  it("fails closed when required production bindings are missing", async () => {
    const state = environment();
    const response = await onRequest(context(new Request("https://erp.test/api/atlas/telemetry/ingest", { method: "POST" }), { ...state.env, R2_BUCKET: undefined } as never));
    expect(response.status).toBe(503);
    expect(state.put).not.toHaveBeenCalled();
  });

  it("rejects timestamps without an explicit timezone and never stores them", async () => {
    const state = environment();
    const request = new Request("https://erp.test/api/atlas/telemetry/ingest", {
      method: "POST",
      headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify({ events: [{ ...position, observed_at: "2026-09-30T23:15:00" }] })
    });
    const response = await onRequest(context(request, state.env));
    expect(response.status).toBe(400);
    expect(state.put).not.toHaveBeenCalled();
  });

  it("rejects conflicting duplicate event identifiers before archiving", async () => {
    const state = environment();
    const request = new Request("https://erp.test/api/atlas/telemetry/ingest", {
      method: "POST",
      headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify({ events: [position, { ...position, latitude: -22.5 }] })
    });
    const response = await onRequest(context(request, state.env));
    expect(response.status).toBe(400);
    expect(state.put).not.toHaveBeenCalled();
  });
});
