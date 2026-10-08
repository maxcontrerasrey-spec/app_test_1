import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../../supabase/migrations/20261008004912_atlas_route_intelligence_shadow.sql", import.meta.url), "utf8");
const edge = readFileSync(new URL("../../supabase/functions/atlas-route-intelligence/index.ts", import.meta.url), "utf8");
const config = readFileSync(new URL("../../supabase/config.toml", import.meta.url), "utf8");

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
    const binding = readFileSync(new URL("../../supabase/migrations/20261008172634_atlas_route_audit_bound_to_saved_route.sql", import.meta.url), "utf8");
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

  it("defaults to OFF, calls the model for every valid route, keeps risk triage bounded, and leaves failed routes as blocked drafts", () => {
    expect(edge).toContain('|| "OFF"');
    expect(edge).toContain('mode !== "SHADOW"');
    expect(edge).toContain("selectManeuversForAiAudit(maneuversWithRestrictions, allCandidates, MAX_AUDITED_MANEUVERS)");
    expect(edge).toContain("const result = await callAuditor(candidates, profile, plannedVehicleType");
    expect(edge).toContain("La ruta se conserva como borrador; no se puede aplicar ni guardar");
    expect(edge).toContain("invalid_evaluation_id");
    expect(edge).toContain("{ evaluationId, candidateHash, vehicleId, model");
  });

  it("accepts only the producer's empty restriction placeholder and reloads validated restrictions server-side", () => {
    expect(edge).toContain("normalizeClientManeuverFeature");
    expect(edge).toContain("getValidatedRestrictions(templateId, token, apiKey)");
  });
});
