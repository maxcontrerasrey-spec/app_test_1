import { useMemo } from "react";
import { useORION } from "../context/ORIONContext";

export function AIChatHistory() {
  const { activeSessionId, createSession, selectSession, sessions } = useORION();
  const orderedSessions = useMemo(
    () =>
      [...sessions].sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt)
      ),
    [sessions]
  );

  return (
    <aside className="orion-history-panel">
      <div className="orion-history-header">
        <button className="orion-new-chat-btn" aria-label="Nueva conversación" onClick={createSession}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Nuevo Chat
        </button>
      </div>

      <div className="orion-history-list">
        <div className="orion-history-group">
          <span className="orion-history-label">Recientes</span>
          {orderedSessions.map((chat) => (
            <button
              key={chat.id}
              className="orion-history-item"
              type="button"
              aria-pressed={chat.id === activeSessionId}
              onClick={() => selectSession(chat.id)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="orion-history-icon">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span className="orion-history-title" title={chat.title}>{chat.title}</span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
