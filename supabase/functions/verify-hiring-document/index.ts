import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getSupabaseSecretKey } from "../_shared/supabaseKeys.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

function requireEnv(value: string | undefined, label: string) {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`Missing ${label}`);
  return normalized;
}

function notFound() {
  return {
    found: false,
    document_kind: "hiring_request",
    is_authentic: false,
    is_current: false,
    status: "not_found"
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const lookup = typeof body.lookup === "string" ? body.lookup.trim() : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(lookup)) {
      return new Response(JSON.stringify(notFound()), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabase = createClient(
      requireEnv(Deno.env.get("SUPABASE_URL"), "SUPABASE_URL"),
      getSupabaseSecretKey(),
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const { data, error } = await supabase.rpc("verify_recruitment_hiring_document", {
      lookup_text: lookup
    });
    if (error) {
      console.error("verify-hiring-document RPC failed", { code: error.code });
      throw new Error("verification_failed");
    }

    return new Response(JSON.stringify(data ?? notFound()), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch {
    return new Response(JSON.stringify({ error: "No fue posible validar el documento." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
