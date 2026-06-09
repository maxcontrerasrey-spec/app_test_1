import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

const encoder = new TextEncoder();
const DEFAULT_MODEL = "llama-3.1-8b-instant";
const DEFAULT_BASE_URL = "https://api.groq.com/openai/v1";
const MAX_CONTEXT_MESSAGES = 24;

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

function sanitizeBaseUrl(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.replace(/\/$/, "") : "";
}

function buildSessionTitle(text: string) {
  const normalized = text.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return "Nueva conversación";
  }

  return normalized.length > 48 ? `${normalized.slice(0, 48)}...` : normalized;
}

function buildSystemPrompt() {
  return [
    "Eres ORION, el copiloto interno de Buses JM dentro del ERP.",
    "Responde en español claro y operativo.",
    "No inventes políticas, procesos, cifras ni estados del sistema.",
    "Si no tienes contexto suficiente, dilo explícitamente.",
    "Aún no tienes RAG corporativo habilitado, por lo que solo puedes ayudar con orientación general basada en la conversación actual."
  ].join(" ");
}

function sendEvent(controller: ReadableStreamDefaultController<Uint8Array>, event: string, data: unknown) {
  controller.enqueue(encoder.encode(`event: ${event}\n`));
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
}

async function parseOpenAICompatibleStream(
  response: Response,
  onContent: (chunk: string) => void
) {
  if (!response.body) {
    throw new Error("El proveedor LLM no devolvió un stream utilizable.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      buffer += decoder.decode();
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const segments = buffer.split("\n\n");
    buffer = segments.pop() ?? "";

    for (const segment of segments) {
      const lines = segment
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.startsWith("data:"));

      for (const line of lines) {
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") {
          continue;
        }

        const json = JSON.parse(payload) as {
          choices?: Array<{
            delta?: { content?: string | null };
            message?: { content?: string | null };
          }>;
        };

        const chunk =
          json.choices?.[0]?.delta?.content ??
          json.choices?.[0]?.message?.content ??
          "";

        if (chunk) {
          onContent(chunk);
        }
      }
    }
  }
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
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const llmApiKey = Deno.env.get("ORION_LLM_API_KEY");
  const llmBaseUrl = sanitizeBaseUrl(Deno.env.get("ORION_LLM_BASE_URL")) || DEFAULT_BASE_URL;
  const llmModel = Deno.env.get("ORION_LLM_MODEL")?.trim() || DEFAULT_MODEL;
  const authHeader = req.headers.get("Authorization");

  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response(JSON.stringify({ error: "Supabase runtime no configurado." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: authHeader ? { Authorization: authHeader } : {}
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Sesión inválida para ORION." }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const body = (await req.json()) as OrionChatRequest;
  const sessionId = body.sessionId?.trim();
  const message = body.message?.trim();
  const source = body.source === "widget" ? "widget" : "full";

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

  if (sessionError || !sessionRow || sessionRow.created_by !== user.id) {
    return new Response(JSON.stringify({ error: "La sesión ORION no existe o no pertenece al usuario." }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  return new Response(
    new ReadableStream({
      async start(controller) {
        try {
          if (!llmApiKey) {
            sendEvent(controller, "error", {
              message: "ORION backend desplegado pero sin secret ORION_LLM_API_KEY en Supabase."
            });
            controller.close();
            return;
          }

          sendEvent(controller, "status", {
            id: "secure-session",
            order: 1,
            text: "Sesión segura validada"
          });

          const { data: contextRows, error: contextError } = await supabase
            .from("orion_messages")
            .select("id, sender, content, created_at")
            .eq("session_id", sessionId)
            .order("created_at", { ascending: false })
            .limit(MAX_CONTEXT_MESSAGES);

          if (contextError) {
            throw new Error(`No fue posible recuperar el contexto de ORION: ${contextError.message}`);
          }

          sendEvent(controller, "status", {
            id: "history-context",
            order: 2,
            text: "Contexto reciente recuperado"
          });

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
              created_by: user.id,
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

          sendEvent(controller, "status", {
            id: "llm-query",
            order: 3,
            text: source === "widget" ? "Generando respuesta rápida" : "Consultando motor ORION"
          });

          const orderedContext = [...((contextRows ?? []) as MessageRow[])].reverse();
          const llmMessages = [
            {
              role: "system",
              content: buildSystemPrompt()
            },
            ...orderedContext.map((row) => ({
              role: row.sender === "user" ? "user" : "assistant",
              content: row.content
            })),
            {
              role: "user",
              content: message
            }
          ];

          const llmResponse = await fetch(`${llmBaseUrl}/chat/completions`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${llmApiKey}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              model: llmModel,
              stream: true,
              temperature: 0.2,
              messages: llmMessages
            })
          });

          if (!llmResponse.ok) {
            const errorText = await llmResponse.text();
            throw new Error(`Proveedor LLM respondió ${llmResponse.status}: ${errorText}`);
          }

          let assistantText = "";
          await parseOpenAICompatibleStream(llmResponse, (chunk) => {
            assistantText += chunk;
            sendEvent(controller, "token", { token: chunk });
          });

          const normalizedAssistantText =
            assistantText.trim() ||
            "ORION no generó contenido utilizable para esta solicitud.";

          sendEvent(controller, "status", {
            id: "persist-response",
            order: 4,
            text: "Persistiendo respuesta"
          });

          const assistantCreatedAt = new Date().toISOString();
          const { data: assistantMessageRow, error: assistantInsertError } = await supabase
            .from("orion_messages")
            .insert({
              session_id: sessionId,
              sender: "ai",
              content: normalizedAssistantText,
              created_by: user.id,
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

          sendEvent(controller, "done", {
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
              vendor: "openai-compatible",
              model: llmModel
            }
          });
        } catch (error) {
          console.error("ORION chat error", error);
          sendEvent(controller, "error", {
            message: error instanceof Error ? error.message : "Fallo interno de ORION."
          });
        } finally {
          controller.close();
        }
      }
    }),
    {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive"
      }
    }
  );
});
