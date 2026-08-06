import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";
import {
  buildOrionSchemaPrompt,
  ORION_READABLE_TABLES,
  type OrionReadableTableConfig,
  type OrionReadableTableName
} from "./erpSchema.ts";
import { redactProviderText, redactProviderToolPayload } from "./privacy.ts";
import { getSupabasePublishableKey, getSupabaseSecretKey } from "../_shared/supabaseKeys.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

const MAX_CONTEXT_MESSAGES = 4;
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

type EmbeddingRunOptions = {
  mean_pool: boolean;
  normalize: boolean;
};

type SupabaseAiSession = {
  run(input: string, options: EmbeddingRunOptions): Promise<ArrayLike<number>>;
};

type SupabaseAiRuntime = {
  ai: {
    Session: new (model: string) => SupabaseAiSession;
  };
};

type GroqToolCall = {
  id: string;
  function: {
    name: string;
    arguments?: string;
  };
};

type GroqChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content?: string;
  tool_calls?: GroqToolCall[];
  tool_call_id?: string;
  name?: string;
};

type EdgeClient = ReturnType<typeof createClient<any, "public", any>>;

function getSupabaseAiRuntime() {
  return (globalThis as typeof globalThis & { Supabase: SupabaseAiRuntime }).Supabase;
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function resolveProviderFailureReason(error: unknown) {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "timeout";
  }

  const status = toErrorMessage(error).match(/status\s+(\d{3})/i)?.[1];
  return status ? `http_${status}` : "request_failed";
}

function buildSessionTitle(text: string) {
  const normalized = text.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return "Nueva conversación";
  }

  return normalized.length > 48 ? `${normalized.slice(0, 48)}...` : normalized;
}

function getAccessTokenFromAuthHeader(authHeader: string | null) {
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice("Bearer ".length).trim();
  return token || null;
}

function sanitizeOutboundText(value: string) {
  return redactProviderText(value)
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
  const config: OrionReadableTableConfig = ORION_READABLE_TABLES[tableName];
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
  messages: GroqChatMessage[];
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
        max_tokens: 512
      }),
      signal: controller.signal
    });

    if (!groqResponse.ok) {
      throw new Error(`Groq API returned status ${groqResponse.status}`);
    }

    return await groqResponse.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

async function executeOrionDatabaseSearch(
  client: EdgeClient,
  args: OrionDatabaseSearchArgs
) {
  const tableName = args.table?.trim();
  if (!tableName || !isReadableTableName(tableName)) {
    throw new Error("La tabla solicitada no está habilitada para lectura desde ORION.");
  }

  const config: OrionReadableTableConfig = ORION_READABLE_TABLES[tableName];
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
  const supabaseServiceRoleKey = getSupabaseSecretKey();
  const authHeader = req.headers.get("Authorization");
  const accessToken = getAccessTokenFromAuthHeader(authHeader);

  const orionLlmApiKey = Deno.env.get("ORION_LLM_API_KEY");
  const orionLlmBaseUrl = Deno.env.get("ORION_LLM_BASE_URL") || "https://api.groq.com/openai/v1";
  const orionLlmModel = Deno.env.get("ORION_LLM_MODEL") || "llama-3.1-8b-instant";

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return new Response(JSON.stringify({ error: "Supabase runtime no configurado." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  if (!accessToken) {
    return new Response(JSON.stringify({ error: "Sesión inválida para ORION." }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const supabase = createClient<any, "public", any>(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser(accessToken);

  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Sesión inválida para ORION." }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const userId = user.id;

  const supabaseAnonKey = getSupabasePublishableKey();
  const supabaseUserClient = createClient<any, "public", any>(supabaseUrl, supabaseAnonKey, {
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
    const llmMessages: GroqChatMessage[] = [...(contextRows ?? [])].reverse().map((row) => ({
      role: row.sender === "user" ? "user" : "assistant",
      content: sanitizeOutboundText(row.content)
    }));

    const sanitizedUserMessage = sanitizeOutboundText(message);
    const systemPrompt = `Eres ORION, el asistente de inteligencia artificial exclusivo de JM (empresa de transporte de pasajeros del sector minero).
Estás conversando con una persona usuaria autenticada del ERP. Si te saluda o hace una pregunta cordial, responde de manera empática, humana y amigable. Actúa como un compañero de trabajo de JM.

Sin embargo, cuando se trate de evaluar información operacional, financiera o contractual, tu función es ser objetivo y crítico.

Reglas obligatorias:
1. Nunca inventes datos, registros, fechas, KPI, contratos, trabajadores, resultados financieros ni conclusiones no respaldadas por evidencia.
2. Si la información solicitada no existe o es insuficiente en el contexto, responde explícitamente: "No dispongo de información suficiente para responder con certeza." (NOTA: Aplica esto SOLO para consultas analíticas o de negocio, NO para saludos o charla general).
3. No seas complaciente en temas operativos. No asumas que el usuario tiene razón. Analiza críticamente cada afirmación y señala errores, inconsistencias, riesgos o debilidades cuando existan.
4. Prioriza precisión, lógica y evidencia por sobre rapidez.
5. Diferencia siempre entre: Hechos observados, Análisis, Hipótesis, Recomendaciones.
6. Cuando realices análisis financieros u operacionales, identifica: Riesgos, Desviaciones, Causas probables, Impacto económico, Nivel de criticidad.
7. Si existen varias interpretaciones posibles, preséntalas indicando el nivel de probabilidad de cada una.
8. No afirmes conclusiones con certeza cuando existan dudas relevantes.
9. Cuando analices información del ERP, limita tus conclusiones únicamente a los datos disponibles.
10. Finaliza los análisis complejos indicando un nivel de confianza: Alta, Media o Baja.

IMPORTANTE:
- Tienes acceso a herramientas read-only (Function Calling) para consultar la base de datos operativa.
- Tienes acceso a la herramienta orion_search_documents para buscar en los documentos y manuales internos de la empresa. Úsala siempre que te pregunten sobre reglamentos, políticas, o procedimientos internos.
- Nunca inventes filas, estados ni relaciones si la consulta no devolvió datos.
- Si necesitas leer datos tabulares, usa primero la herramienta más específica disponible.
- Para preguntas generales del ERP, usa la herramienta universal orion_database_search pero solo con tablas/columnas del mapa permitido.

MAPA DE TABLAS PERMITIDAS:
${buildOrionSchemaPrompt()}`;
    
    const messagesToSend: GroqChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...llmMessages,
      { role: "user", content: sanitizedUserMessage }
    ];

    let normalizedAssistantText = "";
    let vendor = "local-safe";
    let modelUsed: string | null = null;
    let toolPayloadsProcessed = 0;
    let droppedToolFields = 0;

    const serializeProviderToolPayload = (value: unknown) => {
      const result = redactProviderToolPayload(value);
      toolPayloadsProcessed += 1;
      droppedToolFields += result.droppedFields;
      return JSON.stringify(result.value);
    };

    let fallbackReason = "unknown";
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
          },
          {
            type: "function",
            function: {
              name: "orion_search_documents",
              description: "Busca en la base de conocimientos y manuales internos de la empresa mediante similitud semántica. Úsala para buscar reglamentos, políticas o procesos documentados.",
              parameters: {
                type: "object",
                properties: {
                  query: {
                    type: "string",
                    description: "Pregunta o término de búsqueda (ej: 'sanciones por exceso de velocidad')"
                  }
                },
                required: ["query"]
              }
            }
          }
        ];

        let currentMessages: GroqChatMessage[] = [...messagesToSend];
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
          const responseMessage = responseData.choices?.[0]?.message as GroqChatMessage | undefined;

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
                  funcResult = serializeProviderToolPayload(data);
                } else if (funcName === "orion_search_candidate") {
                  const { data, error } = await supabaseUserClient.rpc("orion_search_candidate", { query_text: args.query_text });
                  if (error) throw error;
                  funcResult = serializeProviderToolPayload(data);
                } else if (funcName === "orion_database_search") {
                  const data = await executeOrionDatabaseSearch(supabaseUserClient, args as OrionDatabaseSearchArgs);
                  funcResult = serializeProviderToolPayload(data);
                } else if (funcName === "orion_search_documents") {
                  // --- RAG TOOL LOGIC ---
                  const aiSession = new (getSupabaseAiRuntime().ai.Session)("gte-small");
                  const queryEmbeddingArray = await aiSession.run(args.query || "", { mean_pool: true, normalize: true });
                  const queryEmbedding = Array.from(queryEmbeddingArray);

                  const { data: ragDocs, error: ragError } = await supabase.rpc("match_knowledge_documents", {
                    query_embedding: queryEmbedding,
                    match_threshold: 0.2,
                    match_count: 2
                  });
                  if (ragError) throw ragError;
                  funcResult = serializeProviderToolPayload(ragDocs || []);
                } else {
                  funcResult = serializeProviderToolPayload({ error: "Herramienta desconocida" });
                }
              } catch (err: unknown) {
                console.error("Tool execution error");
                funcResult = serializeProviderToolPayload({ error: toErrorMessage(err) });
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
      } catch (e: unknown) {
        fallbackReason = resolveProviderFailureReason(e);
        console.error(`Groq request failed: ${fallbackReason}`);
        normalizedAssistantText = `[MODO SEGURO] Proveedor no disponible (${fallbackReason}). ` + normalizeAssistantText(buildLocalSafeAssistantText(message));
      }
    } else {
      fallbackReason = "no_api_key";
      normalizedAssistantText = `[MODO SEGURO] Error: Falta ORION_LLM_API_KEY. ` + normalizeAssistantText(buildLocalSafeAssistantText(message));
    }

    if (vendor === "local-safe") {
      vendor = `local-safe: ${fallbackReason}`;
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
          toolPayloadRedactionApplied: toolPayloadsProcessed > 0,
          processedToolPayloads: toolPayloadsProcessed,
          droppedToolFields,
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
    console.error("ORION chat error");
    return new Response(
      JSON.stringify({
        error: "Fallo interno de ORION."
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
