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

export function ORIONProvider({ children }: { children: ReactNode }) {
  const { isLoading: isAuthLoading, user } = useAuth();
  const [sessions, setSessions] = useState<ORIONSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [agentSteps, setAgentSteps] = useState<ORIONAgentStep[]>([]);
  const [isWidgetOpen, setIsWidgetOpen] = useState(false);
  const timeoutIdsRef = useRef<number[]>([]);
  const requestTokenRef = useRef(0);

  const clearPendingTimers = useCallback(() => {
    timeoutIdsRef.current.forEach((timerId) => window.clearTimeout(timerId));
    timeoutIdsRef.current = [];
  }, []);

  useEffect(() => {
    return () => {
      clearPendingTimers();
    };
  }, [clearPendingTimers]);

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    if (!user) {
      requestTokenRef.current += 1;
      clearPendingTimers();
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
  }, [clearPendingTimers, isAuthLoading, user]);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? null,
    [activeSessionId, sessions]
  );

  const createSession = useCallback(async () => {
    clearPendingTimers();
    setIsTyping(false);
    setAgentSteps([]);

    const session = await orionService.createSession();
    if (!session) {
      return;
    }

    const normalizedSession = normalizeSession(session);
    setSessions((current) => [normalizedSession, ...current]);
    setActiveSessionId(normalizedSession.id);
  }, [clearPendingTimers]);

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

      clearPendingTimers();

      const nextTitle =
        activeSession.messages.length <= 1 ? buildSessionTitle(normalized) : activeSession.title;

      const userMessage = await orionService.appendMessage(activeSession.id, "user", normalized);
      if (!userMessage) {
        return;
      }

      setSessions((current) => appendSessionMessage(current, activeSession.id, userMessage, nextTitle));
      void orionService.touchSession(activeSession.id, nextTitle);

      setIsTyping(true);

      const steps: ORIONAgentStep[] =
        source === "widget"
          ? [
              { id: "widget-step-1", text: "Procesando consulta rápida...", status: "pending" },
              { id: "widget-step-2", text: "Sincronizando contexto ORION...", status: "pending" }
            ]
          : [
              { id: "full-step-1", text: "Analizando intención del usuario...", status: "pending" },
              { id: "full-step-2", text: "Sincronizando sesión compartida...", status: "pending" },
              { id: "full-step-3", text: "Preparando backend seguro de Etapa 2...", status: "pending" }
            ];

      setAgentSteps(steps);

      const schedule = (callback: () => void, delayMs: number) => {
        const timerId = window.setTimeout(callback, delayMs);
        timeoutIdsRef.current.push(timerId);
      };

      schedule(() => {
        setAgentSteps((current) =>
          current.map((step, index) => (index === 0 ? { ...step, status: "loading" } : step))
        );
      }, 180);

      schedule(() => {
        setAgentSteps((current) =>
          current.map((step, index) => {
            if (index === 0) return { ...step, status: "done" };
            if (index === 1) return { ...step, status: "loading" };
            return step;
          })
        );
      }, 900);

      if (steps.length > 2) {
        schedule(() => {
          setAgentSteps((current) =>
            current.map((step, index) => {
              if (index === 1) return { ...step, status: "done" };
              if (index === 2) return { ...step, status: "loading" };
              return step;
            })
          );
        }, 1750);
      }

      schedule(() => {
        void (async () => {
          const responseText =
            source === "widget"
              ? "ORION ya comparte la misma conversación entre el widget y la pantalla completa. La siguiente etapa es conectar backend seguro, sesiones persistentes y streaming real."
              : "La Etapa 2 ya quedó aterrizada al repo real: primero sincronizamos sesión global entre widget y pantalla completa; después conectaremos persistencia en Supabase y recién ahí el backend LLM seguro.";

          const aiMessage = await orionService.appendMessage(activeSession.id, "ai", responseText);
          if (aiMessage) {
            setSessions((current) => appendSessionMessage(current, activeSession.id, aiMessage));
            void orionService.touchSession(activeSession.id, nextTitle);
          }

          setAgentSteps([]);
          setIsTyping(false);
          clearPendingTimers();
        })();
      }, steps.length > 2 ? 3000 : 1800);
    },
    [activeSession, clearPendingTimers, isTyping]
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
      sendMessage
    }),
    [
      activeSession,
      activeSessionId,
      agentSteps,
      closeWidget,
      createSession,
      isTyping,
      isWidgetOpen,
      openWidget,
      selectSession,
      sendMessage,
      sessions
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
