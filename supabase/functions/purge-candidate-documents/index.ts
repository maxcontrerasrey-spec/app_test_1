import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

type CleanupRequest = {
  candidateIds?: string[];
  limit?: number;
  sweepTerminalCandidates?: boolean;
};

type CleanupJobRow = {
  id: string;
  recruitment_case_candidate_id: string;
  recruitment_case_id: string;
  candidate_profile_id: string;
  terminal_stage: "rejected" | "withdrawn";
  requested_by: string;
  attempts: number;
};

type CandidateDocumentRow = {
  id: string;
  file_path: string | null;
  document_type_id: string;
  status: string;
};

type TerminalCandidateSweepRow = {
  id: string;
  recruitment_case_id: string;
  candidate_profile_id: string;
  stage_code: "rejected" | "withdrawn";
  created_by: string;
};

type CandidateCleanupGuardRow = {
  id: string;
  recruitment_case_id: string;
  candidate_profile_id: string;
  stage_code: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-webhook-secret"
};

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function requireEnv(value: string | undefined, label: string) {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`Missing ${label}`);
  }

  return normalized;
}

function resolveErrorStatus(error: unknown) {
  const message = toErrorMessage(error);
  if (message === "Unauthorized") {
    return 401;
  }
  if (message.includes("Sin permisos")) {
    return 403;
  }
  if (message.includes("Debe indicar") || message.includes("solo puede ejecutarse")) {
    return 400;
  }

  return 500;
}

async function markJobState(
  supabase: ReturnType<typeof createClient>,
  jobId: string,
  values: Record<string, unknown>
) {
  const { error } = await supabase
    .from("candidate_document_cleanup_jobs")
    .update(values)
    .eq("id", jobId);

  if (error) {
    throw new Error(`No fue posible actualizar candidate_document_cleanup_jobs ${jobId}: ${error.message}`);
  }
}

async function claimJobs(
  supabase: ReturnType<typeof createClient>,
  request: CleanupRequest
) {
  const batchLimit = Math.min(Math.max(request.limit ?? 25, 1), 250);
  const normalizedCandidateIds = Array.from(
    new Set((request.candidateIds ?? []).map((candidateId) => candidateId.trim()).filter(Boolean))
  );
  const candidateIdsParam = normalizedCandidateIds.length > 0 ? normalizedCandidateIds : null;

  const { data, error } = await supabase.rpc("claim_candidate_document_cleanup_jobs", {
    p_limit: batchLimit,
    p_candidate_ids: candidateIdsParam
  });

  if (error) {
    throw new Error(`No fue posible reclamar la cola de limpieza documental: ${error.message}`);
  }

  return (data ?? []) as CleanupJobRow[];
}

async function authorizeInteractiveCleanup(
  supabase: ReturnType<typeof createClient>,
  actorUserId: string,
  request: CleanupRequest
) {
  const normalizedCandidateIds = Array.from(
    new Set((request.candidateIds ?? []).map((candidateId) => candidateId.trim()).filter(Boolean))
  );

  if (request.sweepTerminalCandidates) {
    throw new Error("La barrida masiva nocturna solo puede ejecutarse mediante la invocacion interna.");
  }

  if (normalizedCandidateIds.length === 0) {
    throw new Error("Debe indicar candidatos especificos para ejecutar una limpieza documental interactiva.");
  }

  const { data, error } = await supabase.rpc("authorize_candidate_document_cleanup_targets", {
    p_actor_user_id: actorUserId,
    p_case_candidate_ids: normalizedCandidateIds
  });

  if (error) {
    throw new Error(`No fue posible validar permisos de limpieza documental: ${error.message}`);
  }

  if (data !== true) {
    throw new Error("Sin permisos para ejecutar una o mas limpiezas documentales solicitadas.");
  }
}

async function enqueueSweepJobs(
  supabase: ReturnType<typeof createClient>,
  request: CleanupRequest
) {
  const batchLimit = Math.min(Math.max(request.limit ?? 25, 1), 250);
  const normalizedCandidateIds = Array.from(
    new Set((request.candidateIds ?? []).map((candidateId) => candidateId.trim()).filter(Boolean))
  );

  const candidateIdsParam = normalizedCandidateIds.length > 0 ? normalizedCandidateIds : null;
  const { data: candidateRows, error: candidatesError } = await supabase.rpc(
    "list_terminal_candidate_cleanup_targets",
    {
      p_limit: batchLimit,
      p_candidate_ids: candidateIdsParam
    }
  );

  if (candidatesError) {
    throw new Error(
      `No fue posible inspeccionar candidatos terminales con documentos remanentes: ${candidatesError.message}`
    );
  }

  const terminalCandidates = (candidateRows ?? []) as TerminalCandidateSweepRow[];

  if (terminalCandidates.length === 0) {
    return { queued: 0 };
  }
  const jobsToInsert = terminalCandidates
    .map((candidate) => ({
      recruitment_case_candidate_id: candidate.id,
      recruitment_case_id: candidate.recruitment_case_id,
      candidate_profile_id: candidate.candidate_profile_id,
      terminal_stage: candidate.stage_code,
      requested_by: candidate.created_by,
      status: "pending",
      result_snapshot: {
        queued_at: new Date().toISOString(),
        queued_stage: candidate.stage_code,
        source: "nightly_terminal_sweep"
      }
    }));

  if (jobsToInsert.length === 0) {
    return { queued: 0 };
  }

  const { error: insertError } = await supabase
    .from("candidate_document_cleanup_jobs")
    .insert(jobsToInsert);

  if (insertError) {
    throw new Error(`No fue posible encolar la limpieza nocturna: ${insertError.message}`);
  }

  return { queued: jobsToInsert.length };
}

async function fetchCandidateDocuments(
  supabase: ReturnType<typeof createClient>,
  job: CleanupJobRow
) {
  const { data, error } = await supabase
    .from("candidate_documents")
    .select("id, file_path, document_type_id, status")
    .eq("recruitment_case_id", job.recruitment_case_id)
    .eq("candidate_profile_id", job.candidate_profile_id);

  if (error) {
    throw new Error(`No fue posible leer candidate_documents del candidato ${job.recruitment_case_candidate_id}: ${error.message}`);
  }

  return (data ?? []) as CandidateDocumentRow[];
}

async function assertCandidateCleanupStillApplicable(
  supabase: ReturnType<typeof createClient>,
  job: CleanupJobRow
) {
  const { data, error } = await supabase
    .from("recruitment_case_candidates")
    .select("id, recruitment_case_id, candidate_profile_id, stage_code")
    .eq("id", job.recruitment_case_candidate_id)
    .maybeSingle();

  if (error) {
    throw new Error(
      `No fue posible verificar el estado actual del candidato ${job.recruitment_case_candidate_id}: ${error.message}`
    );
  }

  const candidate = data as CandidateCleanupGuardRow | null;

  if (!candidate) {
    throw new Error(
      `El candidato ${job.recruitment_case_candidate_id} ya no existe para ejecutar la limpieza documental`
    );
  }

  if (
    candidate.recruitment_case_id !== job.recruitment_case_id ||
    candidate.candidate_profile_id !== job.candidate_profile_id
  ) {
    throw new Error(
      `La limpieza documental quedó obsoleta porque el contexto del candidato ${job.recruitment_case_candidate_id} cambió`
    );
  }

  if (candidate.stage_code !== job.terminal_stage) {
    throw new Error(
      `La limpieza documental ya no aplica porque el candidato ${job.recruitment_case_candidate_id} salió de la etapa terminal ${job.terminal_stage}`
    );
  }
}

async function purgeCandidateDocuments(
  supabase: ReturnType<typeof createClient>,
  job: CleanupJobRow
) {
  await assertCandidateCleanupStillApplicable(supabase, job);

  const documents = await fetchCandidateDocuments(supabase, job);
  const filePaths = Array.from(
    new Set(documents.map((document) => document.file_path?.trim() ?? "").filter(Boolean))
  );

  if (filePaths.length > 0) {
    const { error: removeError } = await supabase.storage
      .from("candidate-docs")
      .remove(filePaths);

    if (removeError) {
      throw new Error(`No fue posible eliminar archivos candidate-docs del candidato ${job.recruitment_case_candidate_id}: ${removeError.message}`);
    }
  }

  if (documents.length > 0) {
    const documentIds = documents.map((document) => document.id);
    const { error: deleteError } = await supabase
      .from("candidate_documents")
      .delete()
      .in("id", documentIds);

    if (deleteError) {
      throw new Error(`No fue posible eliminar filas candidate_documents del candidato ${job.recruitment_case_candidate_id}: ${deleteError.message}`);
    }
  }

  const { error: auditError } = await supabase
    .from("recruitment_case_audit_log")
    .insert({
      recruitment_case_id: job.recruitment_case_id,
      recruitment_case_candidate_id: job.recruitment_case_candidate_id,
      actor_user_id: job.requested_by,
      action_type: "candidate_documents_purged",
      metadata: {
        terminal_stage: job.terminal_stage,
        removed_documents_count: documents.length,
        removed_storage_objects_count: filePaths.length,
        source: "purge-candidate-documents"
      }
    });

  if (auditError) {
    throw new Error(`No fue posible auditar la purga documental del candidato ${job.recruitment_case_candidate_id}: ${auditError.message}`);
  }

  return {
    documents,
    filePaths
  };
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
    const supabaseUrl = requireEnv(Deno.env.get("SUPABASE_URL"), "SUPABASE_URL");
    const serviceRoleKey = requireEnv(
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
      "SUPABASE_SERVICE_ROLE_KEY"
    );
    const internalWebhookSecret = (Deno.env.get("CANDIDATE_DOCUMENT_CLEANUP_WEBHOOK_SECRET") ?? "").trim();
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const authHeader = req.headers.get("Authorization") ?? "";
    const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    const suppliedWebhookSecret = (req.headers.get("x-internal-webhook-secret") ?? "").trim();
    const isInternalInvocation =
      internalWebhookSecret.length > 0 && suppliedWebhookSecret === internalWebhookSecret;
    const requestBody = ((await req.json().catch(() => ({}))) as CleanupRequest) ?? {};

    if (!isInternalInvocation) {
      if (!accessToken) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const {
        data: { user },
        error: authError
      } = await supabase.auth.getUser(accessToken);

      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      await authorizeInteractiveCleanup(supabase, user.id, requestBody);
    }

    const sweepSummary = requestBody.sweepTerminalCandidates
      ? await enqueueSweepJobs(supabase, requestBody)
      : { queued: 0 };
    const jobs = await claimJobs(supabase, requestBody);
    const results: Array<Record<string, unknown>> = [];

    for (const job of jobs) {
      try {
        const purgeResult = await purgeCandidateDocuments(supabase, job);

        await markJobState(supabase, job.id, {
          status: "success",
          error_message: null,
          result_snapshot: {
            terminal_stage: job.terminal_stage,
            removed_documents_count: purgeResult.documents.length,
            removed_storage_objects_count: purgeResult.filePaths.length,
            removed_document_ids: purgeResult.documents.map((document) => document.id),
            removed_storage_paths: purgeResult.filePaths
          },
          finished_at: new Date().toISOString()
        });

        results.push({
          jobId: job.id,
          candidateId: job.recruitment_case_candidate_id,
          status: "success",
          removedDocuments: purgeResult.documents.length,
          removedStorageObjects: purgeResult.filePaths.length
        });
      } catch (error) {
        const message = toErrorMessage(error);

        await markJobState(supabase, job.id, {
          status: "error",
          error_message: message,
          result_snapshot: {
            terminal_stage: job.terminal_stage,
            error: message
          },
          finished_at: new Date().toISOString()
        });

        results.push({
          jobId: job.id,
          candidateId: job.recruitment_case_candidate_id,
          status: "error",
          error: message
        });
      }
    }

    return new Response(JSON.stringify({
      mode: isInternalInvocation ? "internal" : "interactive",
      sweepQueued: sweepSummary.queued,
      processed: results
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: toErrorMessage(error) }), {
      status: resolveErrorStatus(error),
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
});
