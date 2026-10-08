import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../../supabase/migrations/20261008004912_atlas_route_intelligence_shadow.sql", import.meta.url), "utf8");
const humanReviewMigration = readFileSync(new URL("../../supabase/migrations/20261008182601_atlas_route_human_review_gate.sql", import.meta.url), "utf8");
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
    expect(operationsApi).toContain("reportedRouteOrderSearch: optimizedRoute.routeOrderSearch");
    expect(edge).toContain("reportedRouteOrderSearch");
    expect(edge).toContain("no afirmar que no hubo comparación de órdenes");
    expect(edge).toContain("di que se evaluó una búsqueda acotada, nunca exhaustiva ni global");
    expect(edge).toContain("route-intelligence-prompt:1.6.0");
    expect(edge).toContain('const routeKind = row.routeKind === undefined ? "OPTIMIZED_PROPOSAL" : row.routeKind');
    expect(edge).toContain('routeSnapshot.routeKind es SAVED_ROUTE_PREVIEW');
    expect(edge).toContain('service_route_id: serviceRouteId');
    expect(operationsApi).toContain('routeKind?: "OPTIMIZED_PROPOSAL" | "SAVED_ROUTE_PREVIEW"');
    expect(operationsApi).toContain('serviceRouteId: options.serviceRouteId ?? null');
    expect(operationsApi).toContain('searchScope: optimizedRoute.routeOrderSearch.searchScope ?? "BOUNDED"');
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
});
