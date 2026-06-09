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

export type ORIONMessage = {
  id: string;
  text: string;
  sender: "user" | "ai";
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
  createSession: () => void;
  selectSession: (sessionId: string) => void;
  sendMessage: (text: string, source: "full" | "widget") => void;
};

const ORIONContext = createContext<ORIONContextValue | null>(null);

const INITIAL_GREETING: ORIONMessage = {
  id: "orion-greeting",
  text: "Hola, soy ORION, el asistente de inteligencia artificial de Buses JM. ¿En qué te puedo ayudar hoy?",
  sender: "ai"
};

function createSessionRecord(id: string): ORIONSession {
  const now = new Date().toISOString();

  return {
    id,
    title: "Nueva conversación",
    createdAt: now,
    updatedAt: now,
    messages: [INITIAL_GREETING]
  };
}

function buildSessionTitle(text: string) {
  const normalized = text.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return "Nueva conversación";
  }

  return normalized.length > 48 ? `${normalized.slice(0, 48)}...` : normalized;
}

export function ORIONProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<ORIONSession[]>(() => [createSessionRecord("orion-session-1")]);
  const [activeSessionId, setActiveSessionId] = useState("orion-session-1");
  const [isTyping, setIsTyping] = useState(false);
  const [agentSteps, setAgentSteps] = useState<ORIONAgentStep[]>([]);
  const [isWidgetOpen, setIsWidgetOpen] = useState(false);
  const timeoutIdsRef = useRef<number[]>([]);
  const sessionSequenceRef = useRef(2);

  const clearPendingTimers = useCallback(() => {
    timeoutIdsRef.current.forEach((timerId) => window.clearTimeout(timerId));
    timeoutIdsRef.current = [];
  }, []);

  useEffect(() => {
    return () => {
      clearPendingTimers();
    };
  }, [clearPendingTimers]);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? null,
    [activeSessionId, sessions]
  );

  const createSession = useCallback(() => {
    clearPendingTimers();
    setIsTyping(false);
    setAgentSteps([]);

    const sessionId = `orion-session-${sessionSequenceRef.current++}`;
    const session = createSessionRecord(sessionId);

    setSessions((current) => [session, ...current]);
    setActiveSessionId(sessionId);
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
    (text: string, source: "full" | "widget") => {
      const normalized = text.trim();
      if (!normalized || isTyping || !activeSession) {
        return;
      }

      clearPendingTimers();

      const userMessage: ORIONMessage = {
        id: `user-${Date.now()}`,
        text: normalized,
        sender: "user"
      };

      const nextTitle =
        activeSession.messages.length <= 1 ? buildSessionTitle(normalized) : activeSession.title;
      const startedAt = new Date().toISOString();

      setSessions((current) =>
        current.map((session) =>
          session.id === activeSession.id
            ? {
                ...session,
                title: nextTitle,
                updatedAt: startedAt,
                messages: [...session.messages, userMessage]
              }
            : session
        )
      );

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
        const responseText =
          source === "widget"
            ? "ORION ya comparte la misma conversación entre el widget y la pantalla completa. La siguiente etapa es conectar backend seguro, sesiones persistentes y streaming real."
            : "La Etapa 2 ya quedó aterrizada al repo real: primero sincronizamos sesión global entre widget y pantalla completa; después conectaremos persistencia en Supabase y recién ahí el backend LLM seguro.";

        const aiMessage: ORIONMessage = {
          id: `ai-${Date.now() + 1}`,
          text: responseText,
          sender: "ai"
        };
        const finishedAt = new Date().toISOString();

        setSessions((current) =>
          current.map((session) =>
            session.id === activeSession.id
              ? {
                  ...session,
                  updatedAt: finishedAt,
                  messages: [...session.messages, aiMessage]
                }
              : session
          )
        );

        setAgentSteps([]);
        setIsTyping(false);
        clearPendingTimers();
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
    throw new Error("useORION debe usarse dentro de ORIONProvider");
  }

  return context;
}
