import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

type RemoveCandidateDocumentRequest = {
  caseCandidateId?: string;
  documentId?: string;
  reason?: string;
};

type CandidateDocumentLookup = {
  file_path: string | null;
};

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

function resolveStatus(error: unknown) {
  const message = toErrorMessage(error);
  if (message === "Unauthorized" || message.includes("Usuario no autenticado")) {
    return 401;
  }
  if (message.includes("Sin permisos")) {
    return 403;
  }
  if (
    message.includes("Debe indicar") ||
    message.includes("Candidato no encontrado") ||
    message.includes("Documento no encontrado") ||
    message.includes("no pueden modificarse")
  ) {
    return 400;
  }

  return 500;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método no permitido." }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  try {
    const supabaseUrl = requireEnv(Deno.env.get("SUPABASE_URL"), "SUPABASE_URL");
    const anonKey = requireEnv(Deno.env.get("SUPABASE_ANON_KEY"), "SUPABASE_ANON_KEY");
    const serviceRoleKey = requireEnv(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), "SUPABASE_SERVICE_ROLE_KEY");
    const authorization = req.headers.get("Authorization") ?? "";

    if (!authorization.startsWith("Bearer ")) {
      throw new Error("Unauthorized");
    }

    const request = (await req.json()) as RemoveCandidateDocumentRequest;
    const caseCandidateId = request.caseCandidateId?.trim();
    const documentId = request.documentId?.trim();
    const reason = request.reason?.trim() || null;

    if (!caseCandidateId || !documentId) {
      throw new Error("Debe indicar candidato y documento a eliminar.");
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false }
    });
    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      throw new Error("Unauthorized");
    }

    const { data: targetData, error: targetError } = await serviceClient.rpc(
      "authorize_candidate_document_removal",
      {
        p_case_candidate_id: caseCandidateId,
        p_document_id: documentId,
        p_actor_user_id: userData.user.id
      }
    );

    if (targetError) {
      throw new Error(targetError.message);
    }

    const document = targetData as CandidateDocumentLookup;
    if (document.file_path?.trim()) {
      const { error: removeError } = await serviceClient.storage
        .from("candidate-docs")
        .remove([document.file_path.trim()]);

      if (removeError) {
        throw new Error(`No fue posible eliminar el archivo de Storage: ${removeError.message}`);
      }
    }

    const { data, error } = await serviceClient.rpc("remove_candidate_document_record", {
      p_case_candidate_id: caseCandidateId,
      p_document_id: documentId,
      p_actor_user_id: userData.user.id,
      p_reason: reason
    });

    if (error) {
      throw new Error(error.message);
    }

    return new Response(JSON.stringify({ ok: true, result: data }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: toErrorMessage(error) }), {
      status: resolveStatus(error),
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
