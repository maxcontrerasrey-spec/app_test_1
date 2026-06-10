import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildOrionSchemaPrompt,
  ORION_READABLE_TABLES,
  type OrionReadableTableName
} from "./erpSchema.ts";

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

type OrionDatabaseSearchArgs = {
  table: string;
  columns?: string[];
  filter_column?: string;
  filter_value?: string;
  exact_match?: boolean;
  limit?: number;
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

function isReadableTableName(value: string): value is OrionReadableTableName {
  return value in ORION_READABLE_TABLES;
}

function clampResultLimit(requested: number | undefined, maxLimit: number | undefined) {
  const safeMax = maxLimit ?? 20;
  if (!requested || Number.isNaN(requested)) {
    return Math.min(10, safeMax);
  }

  return Math.max(1, Math.min(Math.trunc(requested), safeMax));
}

function resolveSelectedColumns(
  requestedColumns: string[] | undefined,
  tableName: OrionReadableTableName
) {
  const config = ORION_READABLE_TABLES[tableName];
  if (!requestedColumns?.length) {
    return [...config.defaultColumns];
  }

  const uniqueColumns = Array.from(new Set(requestedColumns.map((column) => column.trim()).filter(Boolean)));
  const validColumns = uniqueColumns.filter((column) => config.columns.includes(column));

  return validColumns.length > 0 ? validColumns : [...config.defaultColumns];
}

async function requestGroqChatCompletion(params: {
  apiKey: string;
  baseUrl: string;
  model: string;
  messages: Array<Record<string, unknown>>;
  tools?: Array<Record<string, unknown>>;
  toolChoice?: "auto" | "none";
  timeoutMs?: number;
}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), params.timeoutMs ?? 20000);

  try {
    const groqResponse = await fetch(`${params.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${params.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: params.model,
        messages: params.messages,
        ...(params.tools ? { tools: params.tools } : {}),
        ...(params.toolChoice ? { tool_choice: params.toolChoice } : {}),
        temperature: 0.3,
        max_tokens: 1024
      }),
      signal: controller.signal
    });

    if (!groqResponse.ok) {
      const errText = await groqResponse.text();
      throw new Error(`Groq API returned status ${groqResponse.status}: ${errText}`);
    }

    return await groqResponse.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

async function executeOrionDatabaseSearch(
  client: ReturnType<typeof createClient>,
  args: OrionDatabaseSearchArgs
) {
  const tableName = args.table?.trim();
  if (!tableName || !isReadableTableName(tableName)) {
    throw new Error("La tabla solicitada no está habilitada para lectura desde ORION.");
  }

  const config = ORION_READABLE_TABLES[tableName];
  const selectedColumns = resolveSelectedColumns(args.columns, tableName);
  const limit = clampResultLimit(args.limit, config.maxLimit);

  let query = client
    .from(tableName)
    .select(selectedColumns.join(", "))
    .limit(limit);

  if (config.orderBy) {
    query = query.order(config.orderBy.column, { ascending: config.orderBy.ascending ?? true });
  }

  const filterColumn = args.filter_column?.trim();
  const filterValue = args.filter_value?.trim();

  if (filterColumn && filterValue) {
    if (!config.columns.includes(filterColumn)) {
      throw new Error(`La columna ${filterColumn} no está permitida en la tabla ${tableName}.`);
    }

    const exactMatch = Boolean(args.exact_match) || config.exactMatchColumns?.includes(filterColumn);
    query = exactMatch
      ? query.eq(filterColumn, filterValue)
      : query.ilike(filterColumn, `%${filterValue}%`);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return {
    table: tableName,
    columns: selectedColumns,
    rows: data ?? [],
    returned_rows: Array.isArray(data) ? data.length : 0,
    limit
  };
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

  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const supabaseUserClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader || "" } },
    auth: { persistSession: false, autoRefreshToken: false }
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

    // --- START RAG LOGIC ---
    let ragContext = "";
    try {
      // @ts-ignore
      const aiSession = new Supabase.ai.Session("gte-small");
      // @ts-ignore
      const queryEmbeddingArray = await aiSession.run(message, { mean_pool: true, normalize: true });
      const queryEmbedding = Array.from(queryEmbeddingArray);

      const { data: ragDocs, error: ragError } = await supabase.rpc("match_knowledge_documents", {
        query_embedding: queryEmbedding,
        match_threshold: 0.2,
        match_count: 4
      });

      if (!ragError && ragDocs && ragDocs.length > 0) {
        ragContext = "\n\n=== EVIDENCIA DOCUMENTAL RECUPERADA ===\nBasado en los reglamentos y manuales internos de la empresa, ten en cuenta la siguiente información para tu respuesta:\n" + ragDocs.map((d: any) => `- [Archivo: ${d.document_name}]: ${d.content}`).join("\n\n") + "\n=======================================\n";
      }
    } catch (e) {
      console.error("Error en RAG:", e);
    }
    // --- END RAG LOGIC ---

    const sanitizedUserMessage = sanitizeOutboundText(message);
    const systemPrompt = `Eres un analista senior de excelencia operacional, finanzas y contratos para una empresa de transporte de pasajeros del sector minero.

Tu función es evaluar información operacional, financiera y contractual de manera objetiva y crítica.

Reglas obligatorias:
1. Nunca inventes datos, registros, fechas, KPI, contratos, trabajadores, resultados financieros ni conclusiones no respaldadas por evidencia.
2. Si la información disponible es insuficiente, responde explícitamente: "No dispongo de información suficiente para responder con certeza."
3. No seas complaciente. No asumas que el usuario tiene razón. Analiza críticamente cada afirmación y señala errores, inconsistencias, riesgos o debilidades cuando existan.
4. Prioriza precisión, lógica y evidencia por sobre rapidez.
5. Diferencia siempre entre: Hechos observados, Análisis, Hipótesis, Recomendaciones.
6. Cuando realices análisis financieros u operacionales, identifica: Riesgos, Desviaciones, Causas probables, Impacto económico, Nivel de criticidad.
7. Si existen varias interpretaciones posibles, preséntalas indicando el nivel de probabilidad de cada una.
8. No afirmes conclusiones con certeza cuando existan dudas relevantes.
9. Cuando analices información del ERP, limita tus conclusiones únicamente a los datos disponibles.
10. Finaliza los análisis indicando un nivel de confianza: Alta, Media o Baja.

IMPORTANTE:
- Tienes acceso a herramientas read-only (Function Calling) para consultar la base de datos operativa.
- Nunca inventes filas, estados ni relaciones si la consulta no devolvió datos.
- Si necesitas leer datos tabulares, usa primero la herramienta más específica disponible.
- Para preguntas generales del ERP, usa la herramienta universal orion_database_search pero solo con tablas/columnas del mapa permitido.

MAPA DE TABLAS PERMITIDAS:
${buildOrionSchemaPrompt()}` + ragContext;
    
    const messagesToSend = [
      { role: "system", content: systemPrompt },
      ...llmMessages,
      { role: "user", content: sanitizedUserMessage }
    ];

    let normalizedAssistantText = "";
    let vendor = "local-safe";
    let modelUsed: string | null = null;

    if (orionLlmApiKey) {
      try {
        const tools = [
          {
            type: "function",
            function: {
              name: "orion_get_hiring_summary",
              description: "Obtiene un resumen cuantitativo de los folios de contratación activos, agrupados por cargo y estado.",
              parameters: { type: "object", properties: {}, required: [] }
            }
          },
          {
            type: "function",
            function: {
              name: "orion_search_candidate",
              description: "Busca a un candidato por RUT o Nombre y devuelve en qué casos de contratación participa y su etapa actual.",
              parameters: {
                type: "object",
                properties: {
                  query_text: { type: "string", description: "RUT o fragmento del nombre del candidato a buscar." }
                },
                required: ["query_text"]
              }
            }
          },
          {
            type: "function",
            function: {
              name: "orion_database_search",
              description: "Lee datos del ERP en modo solo lectura sobre tablas permitidas. Úsala para consultar módulos completos sin modificar información.",
              parameters: {
                type: "object",
                properties: {
                  table: {
                    type: "string",
                    description: "Nombre exacto de la tabla permitida según el mapa del sistema."
                  },
                  columns: {
                    type: "array",
                    items: { type: "string" },
                    description: "Lista de columnas a devolver. Si se omite, ORION usará columnas por defecto."
                  },
                  filter_column: {
                    type: "string",
                    description: "Columna sobre la cual filtrar."
                  },
                  filter_value: {
                    type: "string",
                    description: "Valor de filtro para buscar registros."
                  },
                  exact_match: {
                    type: "boolean",
                    description: "Usa true para igualdad exacta cuando filtres por identificadores, códigos o RUT."
                  },
                  limit: {
                    type: "integer",
                    description: "Máximo de filas a devolver."
                  }
                },
                required: ["table"]
              }
            }
          }
        ];

        let currentMessages = [...messagesToSend] as any[];
        let iterations = 0;
        const MAX_ITERATIONS = 4;

        while (iterations < MAX_ITERATIONS) {
          iterations++;
          const responseData = await requestGroqChatCompletion({
            apiKey: orionLlmApiKey,
            baseUrl: orionLlmBaseUrl,
            model: orionLlmModel,
            messages: currentMessages,
            tools,
            toolChoice: "auto",
            timeoutMs: 20000
          });
          const responseMessage = responseData.choices?.[0]?.message;

          if (!responseMessage) {
            throw new Error("Groq API returned empty choice content.");
          }

          if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
            currentMessages.push(responseMessage); // Add assistant message with tool_calls

            for (const toolCall of responseMessage.tool_calls) {
              const funcName = toolCall.function.name;
              const args = JSON.parse(toolCall.function.arguments || "{}");
              let funcResult = "";

              try {
                if (funcName === "orion_get_hiring_summary") {
                  const { data, error } = await supabaseUserClient.rpc("orion_get_hiring_summary");
                  if (error) throw error;
                  funcResult = JSON.stringify(data);
                } else if (funcName === "orion_search_candidate") {
                  const { data, error } = await supabaseUserClient.rpc("orion_search_candidate", { query_text: args.query_text });
                  if (error) throw error;
                  funcResult = JSON.stringify(data);
                } else if (funcName === "orion_database_search") {
                  const data = await executeOrionDatabaseSearch(supabaseUserClient, args as OrionDatabaseSearchArgs);
                  funcResult = JSON.stringify(data);
                } else {
                  funcResult = JSON.stringify({ error: "Herramienta desconocida" });
                }
              } catch (err: any) {
                console.error("Tool execution error:", err);
                funcResult = JSON.stringify({ error: err.message });
              }

              currentMessages.push({
                role: "tool",
                tool_call_id: toolCall.id,
                name: funcName,
                content: funcResult
              });
            }
          } else {
            normalizedAssistantText = responseMessage.content?.trim() || "Análisis completado sin contenido adicional.";
            vendor = "groq";
            modelUsed = orionLlmModel;
            break;
          }
        }

        if (!normalizedAssistantText.trim()) {
          const finalResponseData = await requestGroqChatCompletion({
            apiKey: orionLlmApiKey,
            baseUrl: orionLlmBaseUrl,
            model: orionLlmModel,
            messages: [
              ...currentMessages,
              {
                role: "system",
                content:
                  "Ya ejecutaste las herramientas necesarias. Entrega ahora una respuesta final clara, basada solo en los datos obtenidos. No vuelvas a llamar herramientas."
              }
            ],
            toolChoice: "none",
            timeoutMs: 20000
          });

          const finalMessage = finalResponseData.choices?.[0]?.message?.content;
          normalizedAssistantText = normalizeAssistantText(
            typeof finalMessage === "string"
              ? finalMessage
              : "No fue posible cerrar el análisis con una respuesta final."
          );
          vendor = "groq";
          modelUsed = orionLlmModel;
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
