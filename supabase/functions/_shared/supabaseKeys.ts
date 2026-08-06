function requireNonEmpty(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing ${label}`);
  }
  return value.trim();
}

export function getSupabaseSecretKey(name = "default") {
  const modernKeys = Deno.env.get("SUPABASE_SECRET_KEYS")?.trim();

  if (modernKeys) {
    try {
      const parsed = JSON.parse(modernKeys) as Record<string, unknown>;
      return requireNonEmpty(parsed[name], `SUPABASE_SECRET_KEYS.${name}`);
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error("Invalid SUPABASE_SECRET_KEYS JSON");
      }
      throw error;
    }
  }

  // Temporary compatibility path while every deployment is migrated. It can
  // be removed once the legacy key is disabled project-wide.
  return requireNonEmpty(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), "SUPABASE_SECRET_KEYS");
}

export function getSupabasePublishableKey(name = "default") {
  const modernKeys = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")?.trim();

  if (modernKeys) {
    try {
      const parsed = JSON.parse(modernKeys) as Record<string, unknown>;
      return requireNonEmpty(parsed[name], `SUPABASE_PUBLISHABLE_KEYS.${name}`);
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error("Invalid SUPABASE_PUBLISHABLE_KEYS JSON");
      }
      throw error;
    }
  }

  return requireNonEmpty(Deno.env.get("SUPABASE_ANON_KEY"), "SUPABASE_PUBLISHABLE_KEYS");
}
