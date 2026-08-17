import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
const migration = read(
  "supabase/migrations/20260817193000_expire_abandoned_psycholaboral_assessments.sql",
);
const page = read("src/modules/psycholaboral/pages/PsycholaboralManagementPage.tsx");
const service = read("src/modules/psycholaboral/services/psycholaboralApi.ts");
const types = read("src/modules/psycholaboral/types.ts");
const statusMigration = read(
  "supabase/migrations/20260817201000_show_expired_psycholaboral_status.sql",
);

describe("Psycholaboral expiration contract", () => {
  it("expires abandoned 90-minute sessions only at the backend boundary", () => {
    expect(migration).toContain("expire_abandoned_psycholaboral_assessments");
    expect(migration).toContain("execution_status = 'in_progress'");
    expect(migration).toContain("deadline_at <= timezone('utc', now())");
    expect(migration).toContain("execution_status = 'expired'");
    expect(migration).toContain("assessment_expired_by_deadline");
    expect(migration).toContain("grant execute on function public.expire_abandoned_psycholaboral_assessments() to authenticated");
  });

  it("refreshes expirations before listing and permits resend only for expired rows", () => {
    expect(service).toContain("expire_abandoned_psycholaboral_assessments");
    expect(types).toContain('"not_sent" | "sent" | "expired" | "completed"');
    expect(page).toContain('expired: "Desierto"');
    expect(page).toContain('{ key: "expired", label: "Desierto" }');
    expect(page).toContain('row.display_status === "expired"');
    expect(page).toContain('"Reenviar test"');
    expect(statusMigration).toContain("when execution_status = 'expired' then 'expired'");
    expect(statusMigration).toContain("display_status = p_status");
  });
});
