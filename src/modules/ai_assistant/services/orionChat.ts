import { supabase } from "../../../shared/lib/supabase";

export type ORIONStreamStatus = {
  id: string;
  order: number;
  text: string;
};

export type ORIONStreamDonePayload = {
  session: {
    id: string;
    title: string;
    updatedAt: string;
  };
  userMessage: {
    id: string;
    text: string;
    sender: "user";
    createdAt: string;
  };
  assistantMessage: {
    id: string;
    text: string;
    sender: "ai";
    createdAt: string;
  };
  provider?: {
    vendor?: string | null;
    model?: string | null;
  } | null;
};

type StreamHandlers = {
  onStatus?: (status: ORIONStreamStatus) => void;
  onToken?: (token: string) => void;
  onDone?: (payload: ORIONStreamDonePayload) => void;
  onError?: (message: string) => void;
  signal?: AbortSignal;
};

type EdgeErrorPayload = {
  message?: string;
  error?: string;
};

function getFunctionName() {
  const configured = import.meta.env.VITE_ORION_FUNCTION_NAME?.trim();
  return configured || "orion-chat";
}

function buildFunctionUrl() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim().replace(/\/$/, "");
  if (!supabaseUrl) {
    throw new Error("VITE_SUPABASE_URL no está configurado.");
  }

  return `${supabaseUrl}/functions/v1/${getFunctionName()}`;
}

function parseEventBlock(block: string) {
  const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
  let event = "message";
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
      continue;
    }

    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  }

  const rawData = dataLines.join("\n");
  return {
    event,
    data: rawData ? JSON.parse(rawData) : null
  };
}

async function readEdgeError(response: Response) {
  try {
    const payload = (await response.json()) as EdgeErrorPayload;
    return payload.message || payload.error || "Fallo no controlado en ORION.";
  } catch {
    return `ORION respondió ${response.status}.`;
  }
}

export const orionChatService = {
  async streamChat(
    params: {
      sessionId: string;
      message: string;
      source: "full" | "widget";
    },
    handlers: StreamHandlers
  ) {
    if (!supabase) {
      throw new Error("Supabase no está configurado.");
    }

    const {
      data: { session }
    } = await supabase.auth.getSession();

    const accessToken = session?.access_token;
    if (!accessToken) {
      throw new Error("No existe una sesión autenticada para ORION.");
    }

    const response = await fetch(buildFunctionUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        Authorization: `Bearer ${accessToken}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY
      },
      body: JSON.stringify(params),
      signal: handlers.signal
    });

    if (!response.ok || !response.body) {
      throw new Error(await readEdgeError(response));
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        buffer += decoder.decode();
      } else {
        buffer += decoder.decode(value, { stream: true });
      }

      const segments = buffer.split("\n\n");
      buffer = segments.pop() ?? "";

      for (const segment of segments) {
        if (!segment.trim()) {
          continue;
        }

        const parsed = parseEventBlock(segment);

        if (parsed.event === "status" && parsed.data) {
          handlers.onStatus?.(parsed.data as ORIONStreamStatus);
          continue;
        }

        if (parsed.event === "token" && parsed.data) {
          const token = (parsed.data as { token?: string }).token ?? "";
          if (token) {
            handlers.onToken?.(token);
          }
          continue;
        }

        if (parsed.event === "done" && parsed.data) {
          handlers.onDone?.(parsed.data as ORIONStreamDonePayload);
          continue;
        }

        if (parsed.event === "error" && parsed.data) {
          const payload = parsed.data as EdgeErrorPayload;
          handlers.onError?.(payload.message || payload.error || "Fallo interno de ORION.");
        }
      }

      if (done) {
        break;
      }
    }
  }
};
