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

async function fetchJobs(
  supabase: ReturnType<typeof createClient>,
  request: CleanupRequest
) {
  const batchLimit = Math.min(Math.max(request.limit ?? 25, 1), 250);
  let query = supabase
    .from("candidate_document_cleanup_jobs")
    .select("id, recruitment_case_candidate_id, recruitment_case_id, candidate_profile_id, terminal_stage, requested_by, attempts")
    .order("created_at", { ascending: true })
    .limit(batchLimit)
    .in("status", ["pending", "error"]);

  const normalizedCandidateIds = Array.from(
    new Set((request.candidateIds ?? []).map((candidateId) => candidateId.trim()).filter(Boolean))
  );

  if (normalizedCandidateIds.length > 0) {
    query = query.in("recruitment_case_candidate_id", normalizedCandidateIds);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`No fue posible leer la cola de limpieza documental: ${error.message}`);
  }

  return (data ?? []) as CleanupJobRow[];
}

async function enqueueSweepJobs(
  supabase: ReturnType<typeof createClient>,
  request: CleanupRequest
) {
  const batchLimit = Math.min(Math.max(request.limit ?? 25, 1), 250);
  const normalizedCandidateIds = Array.from(
    new Set((request.candidateIds ?? []).map((candidateId) => candidateId.trim()).filter(Boolean))
  );

  const { data: documentRows, error: documentsError } = await supabase
    .from("candidate_documents")
    .select("recruitment_case_id, candidate_profile_id")
    .limit(batchLimit * 10);

  if (documentsError) {
    throw new Error(`No fue posible inspeccionar documentos terminales: ${documentsError.message}`);
  }

  const caseIds = Array.from(
    new Set((documentRows ?? []).map((row) => row.recruitment_case_id).filter(Boolean))
  );
  const candidateProfileIds = Array.from(
    new Set((documentRows ?? []).map((row) => row.candidate_profile_id).filter(Boolean))
  );

  if (caseIds.length === 0 || candidateProfileIds.length === 0) {
    return { queued: 0 };
  }

  let candidateQuery = supabase
    .from("recruitment_case_candidates")
    .select("id, recruitment_case_id, candidate_profile_id, stage_code, created_by")
    .in("recruitment_case_id", caseIds)
    .in("candidate_profile_id", candidateProfileIds)
    .in("stage_code", ["rejected", "withdrawn"]);

  if (normalizedCandidateIds.length > 0) {
    candidateQuery = candidateQuery.in("id", normalizedCandidateIds);
  }

  const { data: candidateRows, error: candidatesError } = await candidateQuery;
  if (candidatesError) {
    throw new Error(`No fue posible inspeccionar candidatos terminales: ${candidatesError.message}`);
  }

  const exactDocumentPairs = new Set(
    (documentRows ?? []).map((row) => `${row.recruitment_case_id}::${row.candidate_profile_id}`)
  );
  const terminalCandidates = ((candidateRows ?? []) as TerminalCandidateSweepRow[])
    .filter((candidate) =>
      exactDocumentPairs.has(`${candidate.recruitment_case_id}::${candidate.candidate_profile_id}`)
    )
    .slice(0, batchLimit);

  if (terminalCandidates.length === 0) {
    return { queued: 0 };
  }

  const candidateIds = terminalCandidates.map((candidate) => candidate.id);
  const { data: existingJobs, error: existingJobsError } = await supabase
    .from("candidate_document_cleanup_jobs")
    .select("recruitment_case_candidate_id, status")
    .in("recruitment_case_candidate_id", candidateIds)
    .in("status", ["pending", "processing", "error"]);

  if (existingJobsError) {
    throw new Error(`No fue posible inspeccionar jobs previos de limpieza: ${existingJobsError.message}`);
  }

  const blockedCandidates = new Set(
    (existingJobs ?? []).map((row) => row.recruitment_case_candidate_id)
  );
  const jobsToInsert = terminalCandidates
    .filter((candidate) => !blockedCandidates.has(candidate.id))
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

async function purgeCandidateDocuments(
  supabase: ReturnType<typeof createClient>,
  job: CleanupJobRow
) {
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
    }

    const requestBody = ((await req.json().catch(() => ({}))) as CleanupRequest) ?? {};
    const sweepSummary = requestBody.sweepTerminalCandidates
      ? await enqueueSweepJobs(supabase, requestBody)
      : { queued: 0 };
    const jobs = await fetchJobs(supabase, requestBody);
    const results: Array<Record<string, unknown>> = [];

    for (const job of jobs) {
      try {
        await markJobState(supabase, job.id, {
          status: "processing",
          attempts: job.attempts + 1,
          started_at: new Date().toISOString(),
          finished_at: null,
          error_message: null
        });

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
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
});
