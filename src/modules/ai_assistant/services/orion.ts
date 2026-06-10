import { logger } from "../../../shared/lib/logger";
import { supabase } from "../../../shared/lib/supabase";

export type ORIONMessageRecord = {
  id: string;
  text: string;
  sender: "user" | "ai";
  createdAt: string;
};

export type ORIONSessionRecord = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ORIONMessageRecord[];
};

type SessionRow = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

type MessageRow = {
  id: string;
  session_id: string;
  sender: "user" | "ai";
  content: string;
  created_at: string;
};

const INITIAL_GREETING_TEXT =
  "Hola, soy ORION, el asistente de inteligencia artificial de Buses JM. ¿En qué te puedo ayudar hoy?";

function normalizeSession(row: SessionRow, messages: MessageRow[]): ORIONSessionRecord {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    messages: messages
      .filter((message) => message.session_id === row.id)
      .sort((left, right) => left.created_at.localeCompare(right.created_at))
      .map((message) => ({
        id: message.id,
        text: message.content,
        sender: message.sender,
        createdAt: message.created_at
      }))
  };
}

export const orionService = {
  async listSessions(): Promise<ORIONSessionRecord[]> {
    if (!supabase) {
      return [];
    }

    const { data: sessionsData, error: sessionsError } = await supabase
      .from("orion_sessions")
      .select("id, title, created_at, updated_at")
      .order("updated_at", { ascending: false });

    if (sessionsError) {
      logger.error("ORION listSessions sessions", sessionsError);
      return [];
    }

    const sessions = (sessionsData ?? []) as SessionRow[];
    if (sessions.length === 0) {
      return [];
    }

    const sessionIds = sessions.map((session) => session.id);
    const { data: messagesData, error: messagesError } = await supabase
      .from("orion_messages")
      .select("id, session_id, sender, content, created_at")
      .in("session_id", sessionIds)
      .order("created_at", { ascending: true });

    if (messagesError) {
      logger.error("ORION listSessions messages", messagesError);
      return sessions.map((session) => normalizeSession(session, []));
    }

    const messages = (messagesData ?? []) as MessageRow[];
    return sessions.map((session) => normalizeSession(session, messages));
  },

  async createSession(): Promise<ORIONSessionRecord | null> {
    if (!supabase) {
      return null;
    }

    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      return null;
    }

    const createdAt = new Date().toISOString();
    const { data: sessionData, error: sessionError } = await supabase
      .from("orion_sessions")
      .insert({
        title: "Nueva conversación",
        created_by: user.id,
        created_at: createdAt,
        updated_at: createdAt
      })
      .select("id, title, created_at, updated_at")
      .single();

    if (sessionError || !sessionData) {
      logger.error("ORION createSession session", sessionError);
      return null;
    }

    const { data: messageData, error: messageError } = await supabase
      .from("orion_messages")
      .insert({
        session_id: sessionData.id,
        sender: "ai",
        content: INITIAL_GREETING_TEXT,
        created_by: user.id,
        created_at: createdAt
      })
      .select("id, session_id, sender, content, created_at")
      .single();

    if (messageError || !messageData) {
      logger.error("ORION createSession greeting", messageError);
      return normalizeSession(sessionData as SessionRow, []);
    }

    return normalizeSession(sessionData as SessionRow, [messageData as MessageRow]);
  },

  async appendMessage(sessionId: string, sender: "user" | "ai", text: string) {
    if (!supabase) {
      return null;
    }

    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      return null;
    }

    const createdAt = new Date().toISOString();
    const { data, error } = await supabase
      .from("orion_messages")
      .insert({
        session_id: sessionId,
        sender,
        content: text,
        created_by: user.id,
        created_at: createdAt
      })
      .select("id, session_id, sender, content, created_at")
      .single();

    if (error || !data) {
      logger.error("ORION appendMessage", error);
      return null;
    }

    return {
      id: data.id,
      text: data.content,
      sender: data.sender,
      createdAt: data.created_at
    } satisfies ORIONMessageRecord;
  },

  async touchSession(sessionId: string, title: string) {
    if (!supabase) {
      return false;
    }

    const { error } = await supabase
      .from("orion_sessions")
      .update({
        title,
        updated_at: new Date().toISOString()
      })
      .eq("id", sessionId);

    if (error) {
      logger.error("ORION touchSession", error);
      return false;
    }

    return true;
  },

  async ensureBootstrapSession() {
    const existing = await this.listSessions();
    if (existing.length > 0) {
      return existing;
    }

    const created = await this.createSession();
    return created ? [created] : [];
  },

  async deleteSession(sessionId: string) {
    if (!supabase) return false;
    const { error } = await supabase.from("orion_sessions").delete().eq("id", sessionId);
    if (error) {
      logger.error("ORION deleteSession", error);
      return false;
    }
    return true;
  },

  async renameSession(sessionId: string, newTitle: string) {
    if (!supabase) return false;
    const { error } = await supabase.from("orion_sessions").update({ title: newTitle }).eq("id", sessionId);
    if (error) {
      logger.error("ORION renameSession", error);
      return false;
    }
    return true;
  }
};
