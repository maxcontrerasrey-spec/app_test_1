import { describe, expect, it } from "vitest";
import { getAtlasRouteEvidenceSecret, hashAtlasRouteEvidence, signAtlasRouteEvidence, verifyAtlasRouteEvidence, type AtlasRouteEvidenceClaims } from "../../supabase/functions/_shared/atlasRouteEvidence";

const secret = "test-only-secret-with-at-least-thirty-two-characters";
const actor = "a5d1b64a-d1c5-4f63-9f1e-8bfab6e11111";
const claims: AtlasRouteEvidenceClaims = {
  evidenceVersion: 1,
  actorUserId: actor,
  issuedAtMs: 1_800_000_000_000,
  geometryHash: "a".repeat(64),
  routeSnapshot: { durationSeconds: 2400, stops: [{ lat: -22, lng: -69 }, { lat: -22.1, lng: -69.1 }] },
  maneuvers: [{ maneuverId: "m-001", maneuverType: "RIGHT" }]
};

describe("Atlas server route evidence", () => {
  it("signs deterministically and verifies only for the active actor and time window", async () => {
    const signature = await signAtlasRouteEvidence(claims, secret);
    expect(await verifyAtlasRouteEvidence(claims, signature, secret, actor, claims.issuedAtMs + 1000)).toBe(true);
    expect(await verifyAtlasRouteEvidence({ ...claims, routeSnapshot: { ...claims.routeSnapshot, stops: [{ lat: 1, lng: 2 }] } }, signature, secret, actor, claims.issuedAtMs + 1000)).toBe(false);
    expect(await verifyAtlasRouteEvidence(claims, signature, secret, "b5d1b64a-d1c5-4f63-9f1e-8bfab6e11111", claims.issuedAtMs + 1000)).toBe(false);
    expect(await verifyAtlasRouteEvidence(claims, signature, secret, actor, claims.issuedAtMs + 1_800_001)).toBe(false);
    expect(await verifyAtlasRouteEvidence(claims, signature, secret, actor, claims.issuedAtMs - 120_001)).toBe(false);
  });

  it("rejects changed stops, maneuvers, geometry hash, and signatures", async () => {
    const signature = await signAtlasRouteEvidence(claims, secret);
    expect(await verifyAtlasRouteEvidence({ ...claims, routeSnapshot: { ...claims.routeSnapshot, durationSeconds: 2500 } }, signature, secret, actor, claims.issuedAtMs)).toBe(false);
    expect(await verifyAtlasRouteEvidence({ ...claims, maneuvers: [{ maneuverId: "m-999" }] }, signature, secret, actor, claims.issuedAtMs)).toBe(false);
    expect(await verifyAtlasRouteEvidence({ ...claims, geometryHash: "b".repeat(64) }, signature, secret, actor, claims.issuedAtMs)).toBe(false);
    expect(await verifyAtlasRouteEvidence(claims, `${signature.slice(0, -1)}x`, secret, actor, claims.issuedAtMs)).toBe(false);
    expect(await hashAtlasRouteEvidence(claims)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("uses only a valid server-side signing key and fails closed when unavailable", () => {
    expect(getAtlasRouteEvidenceSecret((name) => name === "SUPABASE_SECRET_KEYS" ? JSON.stringify({ default: secret }) : undefined)).toBe(secret);
    expect(getAtlasRouteEvidenceSecret((name) => name === "SUPABASE_SECRET_KEYS" ? "{}" : name === "SUPABASE_SERVICE_ROLE_KEY" ? secret : undefined)).toBe(secret);
    expect(getAtlasRouteEvidenceSecret(() => undefined)).toBeNull();
  });
});
