import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

const MAX_CONTEXT_MESSAGES = 8;
const MAX_MESSAGE_CHARS = 600;

type OrionChatRequest = {
  sessionId?: string;
  message?: string;
  source?: "full" | "widget";
};

type SessionRow = {
  id: string;
  title: string;
  created_by: string;
  created_at: string;
  updated_at: string;
};

type MessageRow = {
  id: string;
  sender: "user" | "ai";
  content: string;
  created_at: string;
};

function buildSessionTitle(text: string) {
  const normalized = text.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return "Nueva conversación";
  }

  return normalized.length > 48 ? `${normalized.slice(0, 48)}...` : normalized;
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return atob(padded);
}

function getUserIdFromAuthHeader(authHeader: string | null) {
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice("Bearer ".length).trim();
  const parts = token.split(".");
  if (parts.length < 2) {
    return null;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(parts[1])) as { sub?: unknown };
    return typeof payload.sub === "string" && payload.sub.trim() ? payload.sub : null;
  } catch {
    return null;
  }
}

function sanitizeOutboundText(value: string) {
  return value
    .replace(/\b\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]\b/g, "[rut]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_MESSAGE_CHARS);
}

function normalizeAssistantText(value: string) {
  const normalized = value.trim();
  return normalized || "ORION no generó contenido utilizable para esta solicitud.";
}

function buildLocalSafeAssistantText(message: string) {
  const normalized = sanitizeOutboundText(message).toLowerCase();

  if (!normalized) {
    return "ORION está operando en modo seguro local. Reformula la consulta sin datos sensibles para poder orientarte dentro del ERP.";
  }

  if (normalized.includes("folio") || normalized.includes("contrat")) {
    return [
      "ORION está operando en modo seguro local.",
      "Puedo orientarte con el flujo de contratación dentro del ERP: resumen de procesos, control de candidatos, personal a contratar y aprobaciones.",
      "Si necesitas revisar un folio específico, usa el número de folio dentro del módulo correspondiente y evita incluir datos personales en el chat."
    ].join(" ");
  }

  if (normalized.includes("candidato") || normalized.includes("document")) {
    return [
      "ORION está operando en modo seguro local.",
      "Para control de candidatos, la verificación clave es completar la ficha, cargar documentación obligatoria según tipo de cargo y registrar la validación documental antes de pasar a contratación."
    ].join(" ");
  }

  if (normalized.includes("buk") || normalized.includes("trabajador") || normalized.includes("empleado")) {
    return [
      "ORION está operando en modo seguro local.",
      "Las integraciones BUK deben consultarse desde los módulos ya conectados del ERP. Si buscas datos de trabajadores, usa búsqueda por RUT o nombre dentro de la pantalla operativa correspondiente."
    ].join(" ");
  }

  if (normalized.includes("permiso") || normalized.includes("rol") || normalized.includes("acceso")) {
    return [
      "ORION está operando en modo seguro local.",
      "Los accesos del ERP se gobiernan por perfil, rol y visibilidad de módulo. Si una pantalla no aparece, la revisión correcta es backend: roles, permisos efectivos y acceso al módulo."
    ].join(" ");
  }

  return [
    "ORION está operando en modo seguro local.",
    "Puedo orientarte sobre navegación, módulos, aprobaciones y flujo operativo del ERP sin enviar contexto a servicios externos.",
    "Si quieres una respuesta más precisa, describe el proceso o módulo involucrado sin incluir datos sensibles."
  ].join(" ");
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

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = req.headers.get("Authorization");
  const userId = getUserIdFromAuthHeader(authHeader);

  const orionLlmApiKey = Deno.env.get("ORION_LLM_API_KEY");
  const orionLlmBaseUrl = Deno.env.get("ORION_LLM_BASE_URL") || "https://api.groq.com/openai/v1";
  const orionLlmModel = Deno.env.get("ORION_LLM_MODEL") || "llama-3.1-8b-instant";

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return new Response(JSON.stringify({ error: "Supabase runtime no configurado." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  if (!userId) {
    return new Response(JSON.stringify({ error: "Sesión inválida para ORION." }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  const body = (await req.json()) as OrionChatRequest;
  const sessionId = body.sessionId?.trim();
  const message = body.message?.trim();

  if (!sessionId || !message) {
    return new Response(JSON.stringify({ error: "sessionId y message son obligatorios." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const { data: sessionRow, error: sessionError } = await supabase
    .from("orion_sessions")
    .select("id, title, created_by, created_at, updated_at")
    .eq("id", sessionId)
    .single<SessionRow>();

  if (sessionError || !sessionRow || sessionRow.created_by !== userId) {
    return new Response(JSON.stringify({ error: "La sesión ORION no existe o no pertenece al usuario." }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  try {
    const { data: contextRows, error: contextError } = await supabase
      .from("orion_messages")
      .select("id, sender, content, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(MAX_CONTEXT_MESSAGES);

    if (contextError) {
      throw new Error(`No fue posible recuperar el contexto de ORION: ${contextError.message}`);
    }

    const shouldRetitle =
      sessionRow.title === "Nueva conversación" ||
      !contextRows?.some((row) => row.sender === "user");
    const nextTitle = shouldRetitle ? buildSessionTitle(message) : sessionRow.title;
    const userCreatedAt = new Date().toISOString();

    const { data: userMessageRow, error: userInsertError } = await supabase
      .from("orion_messages")
      .insert({
        session_id: sessionId,
        sender: "user",
        content: message,
        created_by: userId,
        created_at: userCreatedAt
      })
      .select("id, sender, content, created_at")
      .single<MessageRow>();

    if (userInsertError || !userMessageRow) {
      throw new Error(`No fue posible registrar el mensaje del usuario: ${userInsertError?.message ?? "unknown"}`);
    }

    const { error: sessionUpdateError } = await supabase
      .from("orion_sessions")
      .update({
        title: nextTitle,
        updated_at: userCreatedAt
      })
      .eq("id", sessionId);

    if (sessionUpdateError) {
      throw new Error(`No fue posible actualizar la sesión ORION: ${sessionUpdateError.message}`);
    }

    const outboundContextRows = ((contextRows ?? []) as MessageRow[])
      .map((row) => sanitizeOutboundText(row.content))
      .filter(Boolean);

    // Prepare message history for LLM (oldest to newest)
    const llmMessages = [...(contextRows ?? [])].reverse().map((row) => ({
      role: row.sender === "user" ? "user" : "assistant",
      content: sanitizeOutboundText(row.content)
    }));

    const sanitizedUserMessage = sanitizeOutboundText(message);
    const messagesToSend = [
      { role: "system", content: "Eres ORION, el copiloto inteligente del ERP de Buses JM. Ayudas a orientar al usuario con el flujo de contratación, control de candidatos, personal a contratar y aprobaciones, respondiendo de forma concisa y clara en español." },
      ...llmMessages,
      { role: "user", content: sanitizedUserMessage }
    ];

    let normalizedAssistantText = "";
    let vendor = "local-safe";
    let modelUsed: string | null = null;

    if (orionLlmApiKey) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

        const groqResponse = await fetch(`${orionLlmBaseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${orionLlmApiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: orionLlmModel,
            messages: messagesToSend,
            temperature: 0.3,
            max_tokens: 1024
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!groqResponse.ok) {
          const errText = await groqResponse.text();
          throw new Error(`Groq API returned status ${groqResponse.status}: ${errText}`);
        }

        const responseData = await groqResponse.json();
        const choiceText = responseData.choices?.[0]?.message?.content;
        if (typeof choiceText === "string" && choiceText.trim()) {
          normalizedAssistantText = choiceText.trim();
          vendor = "groq";
          modelUsed = orionLlmModel;
        } else {
          throw new Error("Groq API returned empty choice content.");
        }
      } catch (e) {
        console.error("Failed to fetch from Groq, using fallback:", e);
        normalizedAssistantText = normalizeAssistantText(buildLocalSafeAssistantText(message));
      }
    } else {
      normalizedAssistantText = normalizeAssistantText(buildLocalSafeAssistantText(message));
    }

    const assistantCreatedAt = new Date().toISOString();
    const { data: assistantMessageRow, error: assistantInsertError } = await supabase
      .from("orion_messages")
      .insert({
        session_id: sessionId,
        sender: "ai",
        content: normalizedAssistantText,
        created_by: userId,
        created_at: assistantCreatedAt
      })
      .select("id, sender, content, created_at")
      .single<MessageRow>();

    if (assistantInsertError || !assistantMessageRow) {
      throw new Error(
        `No fue posible persistir la respuesta de ORION: ${assistantInsertError?.message ?? "unknown"}`
      );
    }

    const { error: finalSessionUpdateError } = await supabase
      .from("orion_sessions")
      .update({
        title: nextTitle,
        updated_at: assistantCreatedAt
      })
      .eq("id", sessionId);

    if (finalSessionUpdateError) {
      throw new Error(`No fue posible cerrar la sesión ORION: ${finalSessionUpdateError.message}`);
    }

    return new Response(
      JSON.stringify({
        session: {
          id: sessionId,
          title: nextTitle,
          updatedAt: assistantCreatedAt
        },
        userMessage: {
          id: userMessageRow.id,
          text: userMessageRow.content,
          sender: userMessageRow.sender,
          createdAt: userMessageRow.created_at
        },
        assistantMessage: {
          id: assistantMessageRow.id,
          text: assistantMessageRow.content,
          sender: assistantMessageRow.sender,
          createdAt: assistantMessageRow.created_at
        },
        provider: {
          vendor,
          model: modelUsed
        },
        privacy: {
          sanitized: true,
          outboundContextMessages: outboundContextRows.length,
          maxMessageChars: MAX_MESSAGE_CHARS
        }
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      }
    );
  } catch (error) {
    console.error("ORION chat error", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Fallo interno de ORION."
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      }
    );
  }
});
