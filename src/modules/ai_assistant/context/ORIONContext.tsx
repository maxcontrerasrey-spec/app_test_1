import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { useAuth } from "../../auth/context/AuthContext";
import { logger } from "../../../shared/lib/logger";
import { orionChatService, type ORIONStreamDonePayload, type ORIONStreamStatus } from "../services/orionChat";
import {
  orionService,
  type ORIONMessageRecord,
  type ORIONSessionRecord
} from "../services/orion";

export type ORIONMessage = {
  id: string;
  text: string;
  sender: "user" | "ai";
  createdAt?: string;
};

export type ORIONAgentStep = {
  id: string;
  text: string;
  status: "pending" | "loading" | "done";
};

export type ORIONSession = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ORIONMessage[];
};

type ORIONContextValue = {
  sessions: ORIONSession[];
  activeSessionId: string;
  activeSession: ORIONSession | null;
  messages: ORIONMessage[];
  isTyping: boolean;
  agentSteps: ORIONAgentStep[];
  isWidgetOpen: boolean;
  openWidget: () => void;
  closeWidget: () => void;
  createSession: () => Promise<void>;
  selectSession: (sessionId: string) => void;
  sendMessage: (text: string, source: "full" | "widget") => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  renameSession: (sessionId: string, newTitle: string) => Promise<void>;
};

const ORIONContext = createContext<ORIONContextValue | null>(null);

function buildSessionTitle(text: string) {
  const normalized = text.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return "Nueva conversación";
  }

  return normalized.length > 48 ? `${normalized.slice(0, 48)}...` : normalized;
}

function normalizeSession(session: ORIONSessionRecord): ORIONSession {
  return {
    id: session.id,
    title: session.title,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    messages: session.messages
  };
}

function appendSessionMessage(
  sessions: ORIONSession[],
  sessionId: string,
  message: ORIONMessageRecord,
  title?: string
) {
  return sessions.map((session) =>
    session.id === sessionId
      ? {
          ...session,
          title: title ?? session.title,
          updatedAt: message.createdAt,
          messages: [...session.messages, message]
        }
      : session
  );
}

function appendTemporaryMessage(
  sessions: ORIONSession[],
  sessionId: string,
  message: ORIONMessage,
  title?: string
) {
  return sessions.map((session) =>
    session.id === sessionId
      ? {
          ...session,
          title: title ?? session.title,
          updatedAt: message.createdAt ?? session.updatedAt,
          messages: [...session.messages, message]
        }
      : session
  );
}

function upsertStreamingAssistantMessage(
  sessions: ORIONSession[],
  sessionId: string,
  assistantTempId: string,
  token: string
) {
  return sessions.map((session) => {
    if (session.id !== sessionId) {
      return session;
    }

    const currentMessages = [...session.messages];
    const assistantIndex = currentMessages.findIndex((message) => message.id === assistantTempId);

    if (assistantIndex === -1) {
      currentMessages.push({
        id: assistantTempId,
        sender: "ai",
        text: token,
        createdAt: new Date().toISOString()
      });
    } else {
      const assistantMessage = currentMessages[assistantIndex];
      currentMessages[assistantIndex] = {
        ...assistantMessage,
        text: `${assistantMessage.text}${token}`
      };
    }

    return {
      ...session,
      messages: currentMessages
    };
  });
}

function reconcileStreamedMessages(
  sessions: ORIONSession[],
  sessionId: string,
  optimisticUserId: string,
  assistantTempId: string,
  payload: ORIONStreamDonePayload
) {
  return sessions.map((session) => {
    if (session.id !== sessionId) {
      return session;
    }

    const messages = session.messages.map((message) => {
      if (message.id === optimisticUserId) {
        return payload.userMessage;
      }

      if (message.id === assistantTempId) {
        return payload.assistantMessage;
      }

      return message;
    });

    if (!messages.some((message) => message.id === payload.assistantMessage.id)) {
      messages.push(payload.assistantMessage);
    }

    return {
      ...session,
      title: payload.session.title,
      updatedAt: payload.session.updatedAt,
      messages
    };
  });
}

function applyStreamError(
  sessions: ORIONSession[],
  sessionId: string,
  assistantTempId: string,
  errorMessage: string
) {
  return sessions.map((session) => {
    if (session.id !== sessionId) {
      return session;
    }

    const currentMessages = [...session.messages];
    const assistantIndex = currentMessages.findIndex((message) => message.id === assistantTempId);

    if (assistantIndex === -1) {
      currentMessages.push({
        id: assistantTempId,
        sender: "ai",
        text: errorMessage,
        createdAt: new Date().toISOString()
      });
    } else {
      currentMessages[assistantIndex] = {
        ...currentMessages[assistantIndex],
        text: errorMessage
      };
    }

    return {
      ...session,
      messages: currentMessages
    };
  });
}

function buildAgentSteps(nextStatus: ORIONStreamStatus, currentSteps: ORIONAgentStep[]) {
  const previousSteps = currentSteps
    .filter((step) => step.id !== nextStatus.id)
    .map((step) => ({ ...step, status: "done" as const }));

  const currentStep: ORIONAgentStep = {
    id: nextStatus.id,
    text: nextStatus.text,
    status: "loading"
  };

  return [...previousSteps, currentStep];
}

function buildFallbackAssistantText(source: "full" | "widget", errorMessage: string) {
  const fallbackCore =
    source === "widget"
      ? "Modo contingencia activo: la conversación sigue sincronizada entre widget y pantalla completa, pero este ambiente todavía no está resolviendo el backend seguro de ORION."
      : "Modo contingencia activo: la persistencia ya está operativa, pero este ambiente todavía no está resolviendo la Edge Function segura o el secreto del modelo.";

  return `${fallbackCore} Detalle técnico: ${errorMessage}`;
}

export function ORIONProvider({ children }: { children: ReactNode }) {
  const { isLoading: isAuthLoading, user } = useAuth();
  const [sessions, setSessions] = useState<ORIONSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [agentSteps, setAgentSteps] = useState<ORIONAgentStep[]>([]);
  const [isWidgetOpen, setIsWidgetOpen] = useState(false);
  const requestTokenRef = useRef(0);
  const streamAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      streamAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    if (!user) {
      requestTokenRef.current += 1;
      streamAbortRef.current?.abort();
      streamAbortRef.current = null;
      setSessions([]);
      setActiveSessionId("");
      setIsTyping(false);
      setAgentSteps([]);
      return;
    }

    const currentRequestToken = ++requestTokenRef.current;

    const loadSessions = async () => {
      const bootstrapSessions = await orionService.ensureBootstrapSession();
      if (requestTokenRef.current !== currentRequestToken) {
        return;
      }

      const normalizedSessions = bootstrapSessions.map(normalizeSession);
      setSessions(normalizedSessions);
      setActiveSessionId((currentActiveSessionId) => {
        if (
          currentActiveSessionId &&
          normalizedSessions.some((session) => session.id === currentActiveSessionId)
        ) {
          return currentActiveSessionId;
        }

        return normalizedSessions[0]?.id ?? "";
      });
    };

    void loadSessions();
  }, [isAuthLoading, user]);

  const deleteSession = useCallback(async (sessionId: string) => {
    const success = await orionService.deleteSession(sessionId);
    if (success) {
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      setActiveSessionId((current) => (current === sessionId ? "" : current));
    }
  }, []);

  const renameSession = useCallback(async (sessionId: string, newTitle: string) => {
    const success = await orionService.renameSession(sessionId, newTitle);
    if (success) {
      setSessions((prev) => prev.map((s) => s.id === sessionId ? { ...s, title: newTitle } : s));
    }
  }, []);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? null,
    [activeSessionId, sessions]
  );

  const createSession = useCallback(async () => {
    setIsTyping(false);
    setAgentSteps([]);

    const session = await orionService.createSession();
    if (!session) {
      return;
    }

    const normalizedSession = normalizeSession(session);
    setSessions((current) => [normalizedSession, ...current]);
    setActiveSessionId(normalizedSession.id);
  }, []);

  const selectSession = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId);
  }, []);

  const openWidget = useCallback(() => {
    setIsWidgetOpen(true);
  }, []);

  const closeWidget = useCallback(() => {
    setIsWidgetOpen(false);
  }, []);

  const sendMessage = useCallback(
    async (text: string, source: "full" | "widget") => {
      const normalized = text.trim();
      if (!normalized || isTyping || !activeSession) {
        return;
      }

      streamAbortRef.current?.abort();

      const optimisticUserId = `orion-user-${Date.now()}`;
      const assistantTempId = `orion-ai-stream-${Date.now()}`;
      const createdAt = new Date().toISOString();
      const nextTitle =
        activeSession.messages.length <= 1 ? buildSessionTitle(normalized) : activeSession.title;

      setSessions((current) =>
        appendTemporaryMessage(current, activeSession.id, {
          id: optimisticUserId,
          text: normalized,
          sender: "user",
          createdAt
        }, nextTitle)
      );

      setIsTyping(true);
      setAgentSteps([
        {
          id: "bootstrap-stream",
          text: "Conectando ORION seguro",
          status: "loading"
        }
      ]);

      const controller = new AbortController();
      streamAbortRef.current = controller;

      try {
        await orionChatService.streamChat(
          {
            sessionId: activeSession.id,
            message: normalized,
            source
          },
          {
            signal: controller.signal,
            onStatus: (status) => {
              setAgentSteps((current) => buildAgentSteps(status, current));
            },
            onToken: (token) => {
              setSessions((current) =>
                upsertStreamingAssistantMessage(current, activeSession.id, assistantTempId, token)
              );
            },
            onDone: (payload) => {
              setSessions((current) =>
                reconcileStreamedMessages(
                  current,
                  activeSession.id,
                  optimisticUserId,
                  assistantTempId,
                  payload
                )
              );
              setAgentSteps((current) =>
                current.map((step) => ({ ...step, status: "done" as const }))
              );
            },
            onError: (message) => {
              setSessions((current) =>
                applyStreamError(
                  current,
                  activeSession.id,
                  assistantTempId,
                  buildFallbackAssistantText(source, message)
                )
              );
            }
          }
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "No fue posible conectar ORION con el backend seguro.";
        logger.error("ORIONContext sendMessage", error);
        setSessions((current) =>
          applyStreamError(
            current,
            activeSession.id,
            assistantTempId,
            buildFallbackAssistantText(source, message)
          )
        );
      } finally {
        if (streamAbortRef.current === controller) {
          streamAbortRef.current = null;
        }
        setIsTyping(false);
        setAgentSteps((current) =>
          current.map((step) => ({ ...step, status: "done" as const }))
        );
      }
    },
    [activeSession, isTyping]
  );

  const value = useMemo<ORIONContextValue>(
    () => ({
      sessions,
      activeSessionId,
      activeSession,
      messages: activeSession?.messages ?? [],
      isTyping,
      agentSteps,
      isWidgetOpen,
      openWidget,
      closeWidget,
      createSession,
      selectSession,
      sendMessage,
      deleteSession,
      renameSession
    }),
    [
      sessions,
      activeSessionId,
      activeSession,
      activeSession?.messages,
      isTyping,
      agentSteps,
      isWidgetOpen,
      openWidget,
      closeWidget,
      createSession,
      selectSession,
      sendMessage,
      deleteSession,
      renameSession
    ]
  );

  return <ORIONContext.Provider value={value}>{children}</ORIONContext.Provider>;
}

export function useORION() {
  const context = useContext(ORIONContext);

  if (!context) {
    throw new Error("useORION must be used within an ORIONProvider");
  }

  return context;
}
