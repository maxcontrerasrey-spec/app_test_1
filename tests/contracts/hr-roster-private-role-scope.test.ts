import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260915160000_exclude_private_roles_from_hr_roster.sql",
  "utf8"
);

const privateRolePredicate = "coalesce(lower(trim(e.raw_payload ->> 'private_role')), 'false') not in ('true', '1', 'yes', 'si', 'sí')";

describe("HR roster private-role scope contract", () => {
  it("excludes private roles from search, calendar and summary populations", () => {
    expect(migration.split(privateRolePredicate).length - 1).toBe(3);
  });

  it("blocks new assignments while retaining historical rows", () => {
    expect(migration).toContain("Los trabajadores con Rol privado no pertenecen al módulo de Jornadas");
    expect(migration).not.toMatch(/delete\s+from\s+public\.hr_worker_rosters/i);
  });

  it("keeps the existing authenticated RPC grants", () => {
    expect(migration).toContain("grant execute on function public.search_hr_roster_workers(text, integer) to authenticated");
    expect(migration).toContain("grant execute on function public.get_hr_roster_bulk_calendar(date, date, text, text, text) to authenticated");
    expect(migration).toContain("grant execute on function public.get_hr_roster_calendar_summary(date, text, text, text) to authenticated");
  });
});
