import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.108.1";
import { getSupabaseSecretKey } from "../_shared/supabaseKeys.ts";
import {
  generatePsychAIInterpretation,
  sha256Json,
} from "../_shared/psychAi/index.ts";

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

const APP_ORIGIN = (
  Deno.env.get("PUBLIC_APP_URL") ?? "https://gestion.busesjm.cl"
).replace(/\/$/, "");
const corsHeaders = {
  "Access-Control-Allow-Origin": APP_ORIGIN,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  Vary: "Origin",
};
const PSYCH_AI_RUNTIME_VERSION = "gpt5-mini-humanized-v5.2.3";

type JsonRecord = Record<string, unknown>;
type RpcClient = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
};

function response(body: JsonRecord, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function randomToken(byteLength = 32) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join(
    "",
  );
}

async function deterministicAccessCode(secret: string, idempotencyKey: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`psycholaboral:${idempotencyKey}`),
    ),
  );
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(signed.slice(0, 10), (byte) => alphabet[byte % alphabet.length]).join("");
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}

async function hmacSha256(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value),
  );
  return Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}

function cleanText(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function getIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>'"]/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[char] ?? char,
  );
}

function requireEnvironment() {
  const url = Deno.env.get("SUPABASE_URL")?.trim();
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")?.trim();
  if (!url || !anonKey) throw new Error("Configuración Supabase incompleta");
  return { url, anonKey, secretKey: getSupabaseSecretKey() };
}

async function runPsychAIInterpretation(
  admin: RpcClient,
  assessmentId: string,
  actorUserId: string | null,
) {
  const { data: inputPayload, error: payloadError } = await admin.rpc(
    "get_psych_ai_input_payload",
    { p_assessment_id: assessmentId },
  );
  if (payloadError || !inputPayload) {
    throw new Error(payloadError?.message ?? "No fue posible preparar la interpretación.");
  }

  const inputHashPayload = inputPayload && typeof inputPayload === "object" && !Array.isArray(inputPayload)
    ? { ...(inputPayload as JsonRecord), runtime_pipeline_version: PSYCH_AI_RUNTIME_VERSION }
    : { payload: inputPayload, runtime_pipeline_version: PSYCH_AI_RUNTIME_VERSION };
  const inputHash = await sha256Json(inputHashPayload);
  const claimToken = crypto.randomUUID();
  const providerName = Deno.env.get("PSYCH_AI_ENABLED")?.trim().toLowerCase() === "true" &&
      Deno.env.get("PSYCH_AI_PROVIDER")?.trim().toLowerCase() === "openai" &&
      Deno.env.get("OPENAI_API_KEY")?.trim()
    ? "openai"
    : "mock";
  const modelName = providerName === "openai"
    ? Deno.env.get("PSYCH_AI_MODEL")?.trim() || "gpt-5-mini"
    : "mock-psych-ai-v1";
  const { data: claim, error: claimError } = await admin.rpc(
    "claim_psych_ai_interpretation",
    {
      p_assessment_id: assessmentId,
      p_input_hash: inputHash,
      p_provider: providerName,
      p_model: modelName,
      p_claim_token: claimToken,
      p_actor_user_id: actorUserId,
    },
  );
  if (claimError || !claim) {
    throw new Error(claimError?.message ?? "Interpretación en ejecución.");
  }
  const claimed = claim as {
    cached?: boolean;
    interpretation_id?: string;
    run_id?: string;
    payload?: JsonRecord | null;
    system_prompt?: string;
    response_schema?: JsonRecord;
    interpretation?: JsonRecord;
    status?: string;
  };
  if (claimed.cached) {
    return {
      cached: true,
      status: claimed.status,
      interpretation: claimed.interpretation ?? null,
    };
  }

  const generated = await generatePsychAIInterpretation({
    payload: (claimed.payload ?? inputHashPayload) as JsonRecord,
    systemPrompt: cleanText(claimed.system_prompt, 4000),
    responseSchema: (claimed.response_schema ?? {}) as JsonRecord,
  });
  const outputHash = await sha256Json(generated.output);
  const { data: completed, error: completeError } = await admin.rpc(
    "complete_psych_ai_interpretation",
    {
      p_interpretation_id: claimed.interpretation_id,
      p_run_id: claimed.run_id,
      p_claim_token: claimToken,
      p_success: generated.success,
      p_output: generated.success ? generated.output : null,
      p_output_hash: generated.success ? outputHash : null,
      p_validation_flags: generated.validation_flags,
      p_guardrail_flags: generated.guardrail_flags,
      p_latency_ms: generated.latency_ms,
      p_prompt_tokens: generated.usage.prompt_tokens ?? 0,
      p_completion_tokens: generated.usage.completion_tokens ?? 0,
      p_total_tokens: generated.usage.total_tokens ?? 0,
      p_estimated_cost_usd: generated.usage.estimated_cost_usd ?? 0,
      p_metadata: generated.telemetry ?? {},
      p_error_code: generated.error_code,
      p_error_message: generated.error_message,
    },
  );
  if (completeError) {
    try {
      await admin.rpc("complete_psych_ai_interpretation", {
        p_interpretation_id: claimed.interpretation_id,
        p_run_id: claimed.run_id,
        p_claim_token: claimToken,
        p_success: false,
        p_output: null,
        p_output_hash: null,
        p_validation_flags: generated.validation_flags,
        p_guardrail_flags: generated.guardrail_flags,
        p_latency_ms: generated.latency_ms,
        p_prompt_tokens: generated.usage.prompt_tokens ?? 0,
        p_completion_tokens: generated.usage.completion_tokens ?? 0,
        p_total_tokens: generated.usage.total_tokens ?? 0,
        p_estimated_cost_usd: generated.usage.estimated_cost_usd ?? 0,
        p_metadata: generated.telemetry ?? {},
        p_error_code: "persist_failed",
        p_error_message: completeError.message,
      });
    } catch {
      // The caller still receives the persistence failure; this only clears the claim when possible.
    }
    throw new Error("La interpretación se generó, pero no pudo persistirse.");
  }
  if (!generated.success) {
    throw new Error(
      `OpenAI no pudo generar la interpretación: ${generated.fallback_reason || generated.error_message || "provider_failed"}`,
    );
  }
  return {
    cached: false,
    generated: true,
    live_configured: generated.live_configured,
    fallback_reason: generated.fallback_reason,
    result: completed,
  };
}

async function sendAssessmentEmail(input: {
  to: string;
  candidateName: string;
  publicId: string;
  accessCode: string;
  idempotencyKey: string;
}) {
  const resendKey = Deno.env.get("RESEND_API_KEY")?.trim();
  const from = Deno.env.get("HIRING_NOTIFICATIONS_FROM_EMAIL")?.trim();
  if (!resendKey || !from) {
    throw new Error("El servicio de correo no está configurado");
  }

  const link = `${APP_ORIGIN}/evaluacionpsico?invitation=${
    encodeURIComponent(
      input.publicId,
    )
  }`;
  const text =
    `Hola ${input.candidateName},\n\nBuses JM te invita a completar tu evaluación psicolaboral.\n\nEnlace: ${link}\nCódigo temporal: ${input.accessCode}\n\nAl ingresar, el código se utilizará una sola vez. No cierres la página: tendrás 90 minutos continuos para aceptar los consentimientos y completar la batería.\n\nSi no reconoces esta invitación, no utilices el enlace.`;
  const html = `<p>Hola ${
    escapeHtml(
      input.candidateName,
    )
  },</p><p>Buses JM te invita a completar tu evaluación psicolaboral.</p><p><a href="${
    escapeHtml(
      link,
    )
  }">Abrir evaluación</a></p><p><strong>Código temporal:</strong> ${
    escapeHtml(
      input.accessCode,
    )
  }</p><p>Al ingresar, el código se utilizará una sola vez. No cierres la página: tendrás <strong>90 minutos continuos</strong> para aceptar los consentimientos y completar la batería.</p><p>Si no reconoces esta invitación, no utilices el enlace.</p>`;

  const result = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: "Evaluación psicolaboral Buses JM",
      text,
      html,
    }),
  });
  const payload = (await result.json().catch(() => ({}))) as { id?: string };
  if (!result.ok) {
    throw new Error(`El proveedor rechazó el correo (${result.status})`);
  }
  return payload.id ?? null;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return response({ error: "Método no permitido" }, 405);
  }

  try {
    const { url, anonKey, secretKey } = requireEnvironment();
    const payload = (await request.json()) as JsonRecord;
    const action = cleanText(payload.action, 50);
    const admin = createClient(url, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    if (action === "send") {
      const authorization = request.headers.get("authorization") ?? "";
      if (!authorization.startsWith("Bearer ")) {
        return response({ error: "No autorizado" }, 401);
      }
      const actor = createClient(url, anonKey, {
        global: { headers: { Authorization: authorization } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const idempotencyKey = cleanText(payload.idempotency_key, 100) ||
        crypto.randomUUID();
      const invite = await deterministicAccessCode(secretKey, idempotencyKey);
      const { data, error } = await actor.rpc(
        "prepare_psycholaboral_dispatch",
        {
          p_case_candidate_id: cleanText(payload.case_candidate_id, 50),
          p_instrument_codes: Array.isArray(payload.instrument_codes)
            ? payload.instrument_codes
            : [],
          p_invite_hash: await sha256(invite),
          p_idempotency_key: idempotencyKey,
        },
      );
      if (error) return response({ error: error.message }, 400);

      const prepared = data as {
        assessment_id: string;
        public_id: string;
        email: string;
        candidate_name: string;
      };
      try {
        const providerId = await sendAssessmentEmail({
          to: prepared.email,
          candidateName: prepared.candidate_name,
          publicId: prepared.public_id,
          accessCode: invite,
          idempotencyKey: `psycholaboral/${prepared.assessment_id}`,
        });
        const { error: finalizeError } = await admin.rpc(
          "finalize_psycholaboral_dispatch",
          {
            p_assessment_id: prepared.assessment_id,
            p_success: true,
            p_provider_message_id: providerId,
            p_error: null,
          },
        );
        if (finalizeError) {
          throw new Error("No fue posible confirmar la entrega");
        }
        return response({ sent: true, assessment_id: prepared.assessment_id });
      } catch (error) {
        await admin.rpc("finalize_psycholaboral_dispatch", {
          p_assessment_id: prepared.assessment_id,
          p_success: false,
          p_provider_message_id: null,
          p_error: error instanceof Error ? error.message : "Error de correo",
        });
        return response(
          {
            error: "No fue posible enviar la evaluación. Puedes reintentar.",
          },
          502,
        );
      }
    }

    if (
      action === "generate_certificate" ||
      action === "certificate_url" ||
      action === "report_url" ||
      action === "internal_generate_ai_interpretation" ||
      action === "internal_regenerate_certificate" ||
      action === "generate_ai_interpretation" ||
      action === "get_ai_interpretation" ||
      action === "review_ai_interpretation"
    ) {
      if (
        action === "internal_generate_ai_interpretation" ||
        action === "internal_regenerate_certificate"
      ) {
        const internalSecret = Deno.env.get("PSYCH_AI_INTERNAL_WEBHOOK_SECRET")?.trim();
        if (!internalSecret || internalSecret.length < 32) {
          return response({ error: "Canal interno IA no configurado" }, 503);
        }
        if (request.headers.get("x-internal-secret") !== internalSecret) {
          return response({ error: "No autorizado" }, 401);
        }
        const assessmentId = cleanText(payload.assessment_id, 50);
        if (action === "internal_regenerate_certificate") {
          const { error: resetError } = await admin.rpc(
            "reset_psycholaboral_certificate_service",
            { p_assessment_id: assessmentId },
          );
          if (resetError) return response({ error: "No fue posible preparar la regeneración." }, 409);
          const certificateResponse = await fetch(
            `${url}/functions/v1/generate-psycholaboral-certificate`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${secretKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ assessmentId }),
            },
          );
          if (!certificateResponse.ok) {
            return response({ error: "No fue posible regenerar el certificado." }, 409);
          }
          return response({ generated: true });
        }
        try {
          return response(await runPsychAIInterpretation(admin, assessmentId, null));
        } catch (error) {
          return response({
            error: error instanceof Error ? error.message : "No fue posible generar la interpretación IA.",
          }, 409);
        }
      }
      const authorization = request.headers.get("authorization") ?? "";
      if (!authorization.startsWith("Bearer ")) {
        return response({ error: "No autorizado" }, 401);
      }
      const actor = createClient(url, anonKey, {
        global: { headers: { Authorization: authorization } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const assessmentId = cleanText(payload.assessment_id, 50);
      const { error: accessError } = await actor.rpc(
        "get_psycholaboral_result_detail",
        { p_assessment_id: assessmentId },
      );
      if (accessError) return response({ error: "No autorizado" }, 403);

      if (action === "generate_ai_interpretation") {
        const { data: userData } = await actor.auth.getUser();
        try {
          return response(await runPsychAIInterpretation(
            admin,
            assessmentId,
            userData.user?.id ?? null,
          ));
        } catch (error) {
          return response({
            error: error instanceof Error ? error.message : "No fue posible generar la interpretación IA.",
          }, 409);
        }
      }

      if (action === "get_ai_interpretation") {
        const { data, error } = await actor.rpc("get_psych_ai_review_detail", {
          p_assessment_id: assessmentId,
        });
        if (error) return response({ error: error.message }, 400);
        return response({ detail: data as JsonRecord });
      }

      if (action === "review_ai_interpretation") {
        const { data, error } = await actor.rpc(
          "review_psych_ai_interpretation",
          {
            p_interpretation_id: cleanText(payload.interpretation_id, 50),
            p_action: cleanText(payload.review_action, 40),
            p_reviewed_output: payload.reviewed_output ?? null,
            p_comment: cleanText(payload.comment, 1000) || null,
          },
        );
        if (error) return response({ error: error.message }, 400);
        return response({ detail: data as JsonRecord });
      }

      if (action === "generate_certificate") {
        const certificateResponse = await fetch(
          `${url}/functions/v1/generate-psycholaboral-certificate`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${secretKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ assessmentId }),
          },
        );
        if (!certificateResponse.ok) {
          return response(
            { error: "No fue posible generar el certificado. Reintenta." },
            409,
          );
        }
        return response({ generated: true });
      }

      const { data: artifact, error: artifactError } = await actor.rpc(
        action === "report_url"
          ? "get_psycholaboral_report_artifact"
          : "get_psycholaboral_certificate_artifact",
        { p_assessment_id: assessmentId },
      );
      if (artifactError || !artifact) {
        return response({ error: "El certificado todavía no está disponible." }, 409);
      }
      const item = artifact as { bucket: string; path: string };
      const { data: signed, error: signedError } = await admin.storage
        .from(item.bucket)
        .createSignedUrl(item.path, 60);
      if (signedError || !signed?.signedUrl) {
        return response({ error: "No fue posible preparar la descarga." }, 500);
      }
      return response({ signed_url: signed.signedUrl });
    }

    if (action === "redeem") {
      const sessionToken = randomToken();
      const rut = cleanText(payload.rut, 20);
      const temporaryRut = Deno.env.get("PSYCHO_TEMP_TEST_RUT")?.trim();
      const temporaryAccess = temporaryRut &&
        rut.replace(/[^0-9kK]/g, "").toUpperCase() ===
          temporaryRut.replace(/[^0-9kK]/g, "").toUpperCase();
      const rpc = temporaryAccess
        ? "redeem_psycholaboral_temporary_test_access"
        : "redeem_psycholaboral_invite";
      const params = temporaryAccess
        ? {
          p_public_id: cleanText(payload.public_id, 50),
          p_rut: rut,
          p_session_hash: await sha256(sessionToken),
          p_ip_hash: await hmacSha256(secretKey, getIp(request)),
        }
        : {
          p_public_id: cleanText(payload.public_id, 50),
          p_rut: rut,
          p_invite_hash: await sha256(cleanText(payload.access_code, 50).toUpperCase()),
          p_session_hash: await sha256(sessionToken),
          p_ip_hash: await hmacSha256(secretKey, getIp(request)),
        };
      const { data, error } = await admin.rpc(rpc, params);
      if (error) {
        return response({ error: "No fue posible validar los datos." }, 400);
      }
      if ((data as { access_denied?: boolean } | null)?.access_denied) {
        return response({ error: "No fue posible validar los datos." }, 400);
      }
      return response({
        session_token: sessionToken,
        session: data as JsonRecord,
      });
    }

    const sessionToken = cleanText(payload.session_token, 200);
    if (!sessionToken) {
      return response({ error: "La sesión no es válida." }, 401);
    }
    const sessionHash = await sha256(sessionToken);

    if (action === "resume") {
      const { data, error } = await admin.rpc(
        "get_psycholaboral_candidate_session",
        { p_session_hash: sessionHash },
      );
      if (error) return response({ error: error.message }, 400);
      return response({ session: data as JsonRecord });
    }

    if (action === "accept_consents") {
      const { data, error } = await admin.rpc("accept_psycholaboral_consents", {
        p_session_hash: sessionHash,
        p_consents: Array.isArray(payload.consents) ? payload.consents : [],
        p_ip_hash: await hmacSha256(secretKey, getIp(request)),
        p_user_agent_hash: await hmacSha256(
          secretKey,
          request.headers.get("user-agent") ?? "unknown",
        ),
      });
      if (error) return response({ error: error.message }, 400);
      return response({ session: data as JsonRecord });
    }

    if (action === "save") {
      const { data, error } = await admin.rpc("save_psycholaboral_responses", {
        p_session_hash: sessionHash,
        p_instrument_code: cleanText(payload.instrument_code, 50),
        p_responses: payload.responses ?? {},
        p_expected_revision: Number(payload.expected_revision ?? 0),
      });
      if (error) return response({ error: error.message }, 409);
      return response(data as JsonRecord);
    }

    if (action === "submit") {
      const { data, error } = await admin.rpc(
        "submit_psycholaboral_instrument",
        {
          p_session_hash: sessionHash,
          p_instrument_code: cleanText(payload.instrument_code, 50),
          p_responses: payload.responses ?? {},
        },
      );
      if (error) return response({ error: error.message }, 400);

      const session = data as {
        execution_status?: string;
        assessment_id?: string;
      };
      if (session.execution_status === "completed" && session.assessment_id) {
        const postCompletionJob = (async () => {
          try {
            await runPsychAIInterpretation(admin, session.assessment_id!, null);
          } catch (error) {
            console.error(
              "psycholaboral automatic AI failed",
              error instanceof Error ? error.message : "unknown",
            );
          }
          const certificateUrl =
            `${url}/functions/v1/generate-psycholaboral-certificate`;
          await fetch(certificateUrl, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${secretKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ assessmentId: session.assessment_id }),
          }).catch(() => undefined);
        })();
        // Supabase Edge keeps the automatic IA and certificate chain alive after returning the candidate response.
        EdgeRuntime.waitUntil(postCompletionJob);
      }
      return response({ session });
    }

    return response({ error: "Acción no soportada" }, 400);
  } catch (error) {
    console.error(
      "psycholaboral-assessment failed",
      error instanceof Error ? error.message : "unknown",
    );
    return response({ error: "No fue posible procesar la solicitud." }, 500);
  }
});
