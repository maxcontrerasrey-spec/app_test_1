import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

function requireEnv(value: string | undefined, label: string) {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`Missing ${label}`);
  }

  return normalized;
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function maskDocumentNumber(value: unknown) {
  if (typeof value !== "string") return "***";
  const normalized = value.replace(/[^0-9Kk]/g, "").toUpperCase();
  return normalized.length < 4 ? "***" : `***.***.${normalized.slice(-4)}`;
}

function sanitizePublicPayload(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const payload = structuredClone(value as Record<string, unknown>);
  for (const sectionName of ["worker", "instructor"] as const) {
    const section = payload[sectionName];
    if (section && typeof section === "object" && !Array.isArray(section)) {
      const record = section as Record<string, unknown>;
      record.document_number = maskDocumentNumber(record.document_number);
      if ("documentNumber" in record) record.documentNumber = maskDocumentNumber(record.documentNumber);
    }
  }
  return payload;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const lookup = typeof body.lookup === "string" ? body.lookup.trim() : "";

    if (lookup.length < 6 || lookup.length > 120) {
      return new Response(
        JSON.stringify({
          found: false,
          is_authentic: false,
          is_current: false,
          status: "not_found"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = requireEnv(Deno.env.get("SUPABASE_URL"), "SUPABASE_URL");
    const serviceRoleKey = requireEnv(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), "SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });

    const { data, error } = await supabase.rpc("verify_competency_certificate", {
      lookup_text: lookup
    });

    if (error) {
      throw new Error(error.message);
    }

    return new Response(JSON.stringify(sanitizePublicPayload(data)), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("verify-competency-certificate failed", { message: toErrorMessage(error) });
    return new Response(JSON.stringify({ error: "No fue posible validar el certificado." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
