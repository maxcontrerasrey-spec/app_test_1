import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../../supabase/migrations/20261008004912_atlas_route_intelligence_shadow.sql", import.meta.url), "utf8");
const humanReviewMigration = readFileSync(new URL("../../supabase/migrations/20261008182601_atlas_route_human_review_gate.sql", import.meta.url), "utf8");
const shortRoutePolicyMigration = readFileSync(new URL("../../supabase/migrations/20261009004914_atlas_short_route_soft_penalty_is_non_blocking.sql", import.meta.url), "utf8");
const shortRouteViabilityMigration = readFileSync(new URL("../../supabase/migrations/20261009015908_atlas_under_50_minute_route_viability.sql", import.meta.url), "utf8");
const edge = readFileSync(new URL("../../supabase/functions/atlas-route-intelligence/index.ts", import.meta.url), "utf8");
const config = readFileSync(new URL("../../supabase/config.toml", import.meta.url), "utf8");
const planner = readFileSync(new URL("../../supabase/functions/atlas-tomtom-planning/index.ts", import.meta.url), "utf8");
const operationsApi = readFileSync(new URL("../../src/modules/operaciones/services/atlasOperationsApi.ts", import.meta.url), "utf8");

describe("Atlas Route Intelligence security contract", () => {
  it("requires JWT and server-verified superadmin before reading or persisting route evidence", () => {
    expect(config).toMatch(/\[functions\.atlas-route-intelligence\]\s+verify_jwt = true/);
    expect(edge).toContain("atlas_ops_is_current_super_admin");
    expect(migration).toMatch(/if actor is null or not public\.atlas_ops_is_current_super_admin\(\) then raise exception 'Solo un superadministrador puede registrar auditorías/);
    expect(migration).toMatch(/if actor is null or not public\.atlas_ops_is_current_super_admin\(\) then raise exception 'Solo un superadministrador puede registrar feedback/);
  });

  it("keeps audit and restriction evidence append-only with RLS and no direct DML grants", () => {
    expect(migration).toMatch(/alter table public\.atlas_ops_route_intelligence_runs enable row level security/);
    expect(migration).toMatch(/revoke all on public\.atlas_ops_vehicle_routing_profiles[\s\S]*from public, anon, authenticated/);
    expect(migration).toMatch(/create trigger atlas_ops_route_intelligence_runs_immutable before update or delete/);
    expect(migration).toMatch(/create trigger atlas_ops_route_intelligence_feedback_immutable before update or delete/);
    expect(migration).toMatch(/create trigger atlas_ops_route_restriction_events_immutable before update or delete/);
    expect(migration).toContain("grant execute on function public.atlas_ops_record_route_intelligence_run(jsonb) to authenticated");
    expect(migration).toContain("grant execute on function public.atlas_ops_record_route_intelligence_feedback(uuid,text,text) to authenticated");
  });

  it("keeps the OpenAI credential server-side, uses GPT-6 Luna, and never stores Responses API input", () => {
    expect(edge).toContain('const MODEL = "gpt-6-luna"');
    expect(edge).toContain('Deno.env.get("OPENAI_API_KEY")');
    expect(edge).toContain("store: false");
    expect(edge).toContain('Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")');
  });

  it("binds saved route stops and metrics to a persisted OpenAI audit", () => {
    const binding = readFileSync(new URL("../../supabase/migrations/20261008175339_atlas_route_audit_bound_to_saved_route.sql", import.meta.url), "utf8");
    expect(binding).toContain("p_route_intelligence_run_id uuid");
    expect(binding).toContain("audit_row.actor_user_id <> actor");
    expect(binding).toContain("audit_row.provider <> 'openai'");
    expect(binding).toContain("audit_row.decision in ('ERROR','REJECT')");
    expect(binding).toContain("audit_row.requires_replan");
    expect(binding).toContain("submitted_stops is distinct from audit_row.route_snapshot->'stops'");
    expect(binding).toContain("from public, anon, authenticated");
    expect(binding).toContain("to service_role");
    expect(binding).toContain("coalesce(auth.role(),'') <> 'service_role'");
    expect(edge).toContain("actor_user_id: actorUserId");
    expect(binding).toMatch(/revoke all on function public\.atlas_ops_save_optimized_service_route\([^;]+authenticated/);
  });

  it("requires positive human feedback before saving an audit that requests human review", () => {
    expect(humanReviewMigration).toContain("if audit_row.requires_human_review and not exists (");
    expect(humanReviewMigration).toContain("f.feedback_type in ('ACCEPT_AI','OVERRIDE_FEASIBLE')");
    expect(humanReviewMigration).toContain("from public, anon");
    expect(humanReviewMigration).toContain("to authenticated");
  });

  it("fails closed in the database when route or maneuver evidence implies review or replan", () => {
    const strictGate = readFileSync(new URL("../../supabase/migrations/20261008185321_atlas_route_insufficient_evidence_requires_review.sql", import.meta.url), "utf8");
    expect(strictGate).toContain("audit_row.decision = 'INSUFFICIENT_EVIDENCE'");
    expect(strictGate).toContain("maneuver->>'decision' = 'INSUFFICIENT_EVIDENCE'");
    expect(strictGate).toContain("maneuver->>'recommendedAction' in ('HUMAN_REVIEW','PENALIZE_SEGMENT')");
    expect(strictGate).toContain("maneuver->>'recommendedAction' in ('BLOCK_MANEUVER','REQUEST_ALTERNATIVE')");
    expect(strictGate).toContain("f.feedback_type in ('ACCEPT_AI','OVERRIDE_FEASIBLE')");
    expect(strictGate).toContain("from public, anon");
    expect(strictGate).toContain("to authenticated");
  });

  it("uses the signed complete-route duration to keep all AI route findings advisory below 50 minutes", () => {
    expect(shortRouteViabilityMigration).toContain("< 3000 else false end as route_under_50_minutes");
    expect(shortRouteViabilityMigration).toContain("when route_under_50_minutes then false");
    expect(shortRouteViabilityMigration).toContain("audit_row.decision = 'ERROR'");
    expect(shortRouteViabilityMigration).toContain("audit_row.route_evidence_version <> 1");
    expect(shortRouteViabilityMigration).toContain("audit_row.route_snapshot->'stops'");
    expect(shortRouteViabilityMigration).toContain("ai.decision <> 'ERROR'");
    expect(shortRouteViabilityMigration).toContain("ai.route_evidence_hash ~ '^[a-f0-9]{64}$'");
    expect(shortRouteViabilityMigration).toContain("public.atlas_ops_route_audit_needs_human_feedback(");
    expect(shortRouteViabilityMigration).toContain("grant execute on function public.atlas_ops_save_optimized_service_route");
    expect(shortRouteViabilityMigration).toContain("from public, anon, authenticated");
    expect(shortRoutePolicyMigration).toContain("< 3000 else false end as route_under_50_minutes");
  });

  it("defaults to OFF, calls the model for every valid route, keeps risk triage bounded, and leaves failed routes as blocked drafts", () => {
    expect(edge).toContain('|| "OFF"');
    expect(edge).toContain('mode !== "SHADOW"');
    expect(edge).toContain("selectManeuversForAiAudit(maneuversWithRestrictions, allCandidates, MAX_AUDITED_MANEUVERS)");
    expect(edge).toContain("const result = await callAuditor(candidates, profile, plannedVehicleType");
    expect(edge).toContain("La ruta se conserva como borrador; no se puede aplicar ni guardar");
    expect(edge).toContain("invalid_evaluation_id");
    expect(edge).toContain("{ evaluationId, candidateHash, vehicleId, model");
  });

  it("passes bounded Valhalla route-order search evidence to AI instead of letting it claim no comparison occurred", () => {
    expect(planner).toContain("reportedRouteOrderSearch: result.routeOrderSearch ?? null");
    expect(edge).toContain("reportedRouteOrderSearch");
    expect(edge).toContain("no afirmar que no hubo comparación de órdenes");
    expect(edge).toContain("di que se evaluó una búsqueda acotada, nunca exhaustiva ni global");
    expect(edge).toContain("route-intelligence-prompt:1.8.0");
    expect(edge).toContain("no pidas cambiar manualmente el orden de puntos");
    expect(edge).toContain("Devuelve exactamente un resultado por cada maniobra recibida");
    expect(edge).toContain("routeDurationSeconds: routeSnapshot.durationSeconds");
    expect(edge).toContain('const routeKind = row.routeKind === undefined ? "OPTIMIZED_PROPOSAL" : row.routeKind');
    expect(edge).toContain('routeSnapshot.routeKind es SAVED_ROUTE_PREVIEW');
    expect(edge).toContain('service_route_id: serviceRouteId');
    expect(operationsApi).toContain('routeKind?: "OPTIMIZED_PROPOSAL" | "SAVED_ROUTE_PREVIEW"');
    expect(operationsApi).toContain('serviceRouteId: options.serviceRouteId ?? null');
    expect(planner).toContain('searchScope: "BOUNDED"');
    expect(planner).toContain('optimized.candidateOrders.slice(1, 9)');
    expect(planner).toContain('routeOrderAlternativeBudget(stops.length)');
    expect(planner).toContain('payload.excludedOrders.length > 8');
    expect(operationsApi).toContain('...(excludedOrders?.length ? { excludedOrders } : {})');
  });

  it("accepts only the producer's empty restriction placeholder and reloads validated restrictions server-side", () => {
    expect(edge).toContain("normalizeClientManeuverFeature");
    expect(edge).toContain("getValidatedRestrictions(templateId, token, apiKey)");
  });

  it("validates leg metadata against the exact stop snapshot before asking AI", () => {
    expect(edge).toContain("hasValidManeuverLegContext(normalizedManeuvers, routeSnapshot.stops.length)");
    expect(edge).toContain("invalid_maneuver_leg_context");
    expect(edge).toContain("routeLegIndex");
    expect(edge).toContain("legDestinationIsFinal");
    expect(edge).toContain("const MAX_AUDITED_MANEUVERS = 20");
  });

  it("accepts only planner-signed route evidence and persists its verified provenance", () => {
    const evidence = readFileSync(new URL("../../supabase/functions/_shared/atlasRouteEvidence.ts", import.meta.url), "utf8");
    const attestationMigration = readFileSync(new URL("../../supabase/migrations/20261009010200_atlas_route_evidence_attestation.sql", import.meta.url), "utf8");
    expect(planner).toContain("attachServerEvidence(routeResult, orderedStops, actorUserId, \"OPTIMIZED_PROPOSAL\")");
    expect(planner).toContain("const orderedStops = orderRouteStopsByIndex(stopsByInputIndex, finalOrder)");
    expect(planner).not.toContain("finalOrder.map((index) => selectedStops[index]!)");
    expect(planner).toContain("attachServerEvidence(routeResult, stops, actorUserId, routeKind)");
    expect(edge).toContain("verifyAtlasRouteEvidence(claims, proof.signature, secret, actorUserId)");
    expect(edge).toContain("normalizeRouteSnapshot(proof.routeSnapshot)");
    expect(edge).not.toContain("normalizeRouteSnapshot(body.routeSnapshot)");
    expect(edge).toContain("route_evidence_version: proof.evidenceVersion");
    expect(attestationMigration).toContain("route_evidence_version = 1");
    expect(attestationMigration).toContain("route_evidence_version smallint not null default 0");
    expect(attestationMigration).toContain("atlas_ops_route_evidence_link_guard");
    expect(attestationMigration).toContain("atlas_ops_dispatch_attested_route_guard");
    expect(evidence).toContain("ATLAS_ROUTE_EVIDENCE_MAX_AGE_MS");
    expect(readFileSync(new URL("../../src/modules/operaciones/pages/OperationsRoutePlannerDemo.tsx", import.meta.url), "utf8")).toContain("routeGeometriesMatch(driverAuditRoute.coordinates, driverRoute.geometry)");
    expect(readFileSync(new URL("../../supabase/functions/atlas-tomtom-planning/routeIntelligence.ts", import.meta.url), "utf8")).toContain("const requiresHumanReview = !shortRouteIsOperationallyViable");
  });
});
