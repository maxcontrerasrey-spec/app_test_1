import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20261007195115_worker_search_accent_insensitive.sql",
  "utf8"
);
const workerLookupHooks = [
  "src/modules/accreditation/hooks/useAccreditationQueries.ts",
  "src/modules/competencies/hooks/useCompetencyQueries.ts",
  "src/modules/incentives/hooks/useIncentivesQueries.ts",
  "src/modules/internal_mobility/hooks/useInternalMobilityQueries.ts",
  "src/modules/roster/hooks/useRosterQueries.ts",
  "src/modules/sanctions/hooks/useSanctionsQueries.ts"
].map((path) => readFileSync(path, "utf8"));
const workerLookupUi = readFileSync("src/shared/ui/forms/WorkerLookupField.tsx", "utf8");
const operationsPage = readFileSync(
  "src/modules/operaciones/pages/OperationsControlTowerPage.tsx",
  "utf8"
);
const accreditationView = readFileSync(
  "src/modules/accreditation/components/AccreditationWorkersView.tsx",
  "utf8"
);

describe("BUK worker search accent-insensitive database contract", () => {
  it("normalizes both the search term and indexed worker fields in each affected RPC", () => {
    expect(migration).toContain(
      "normalized_search text := public.normalize_recruitment_search_text(coalesce(p_search, ''));"
    );
    expect(migration).toContain("public.normalize_recruitment_search_text(\n        concat_ws(");
    expect(migration).toContain("public.normalize_recruitment_search_text(\n       concat_ws(");
    expect(migration.match(/public\.build_employee_document_digits\(/g)).toHaveLength(2);
    expect(migration).not.toContain("lower(concat_ws(");
  });

  it("preserves the current authorization contract and RUT/document matching", () => {
    expect(migration).toContain("public.user_can_manage_accreditation(current_user_id)");
    expect(migration).toContain("public.user_can_access_hr_sanctions(current_user_id)");
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = public");
    expect(migration).not.toMatch(/\b(?:grant|revoke)\b/i);
  });

  it("routes BUK worker lookup modules through the shared query and debounce policy", () => {
    for (const hook of workerLookupHooks) {
      expect(hook).toContain("createWorkerSearchQueryOptions");
      expect(hook).toContain("normalizeRutAwareWorkerSearchTerm");
    }

    expect(workerLookupUi).toContain("WORKER_SEARCH_DEBOUNCE_MS");
    expect(workerLookupUi).not.toContain("debounceMs?: number");
    expect(operationsPage).toContain("createWorkerSearchQueryOptions");
    expect(operationsPage).toContain("WORKER_SEARCH_DEBOUNCE_MS");
    expect(accreditationView).toContain("WORKER_SEARCH_DEBOUNCE_MS");
  });
});
