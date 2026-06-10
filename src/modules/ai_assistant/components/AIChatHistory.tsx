import { useMemo, useState } from "react";
import { useORION } from "../context/ORIONContext";

export function AIChatHistory() {
  const { activeSessionId, createSession, selectSession, sessions, deleteSession, renameSession } = useORION();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

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
            <div key={chat.id} style={{ display: "flex", alignItems: "center", position: "relative" }}>
              {editingId === chat.id ? (
                <div style={{ display: "flex", width: "100%", padding: "8px", background: "var(--bg-active)", borderRadius: "6px" }}>
                  <input
                    autoFocus
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        renameSession(chat.id, editTitle);
                        setEditingId(null);
                      } else if (e.key === "Escape") {
                        setEditingId(null);
                      }
                    }}
                    onBlur={() => {
                      renameSession(chat.id, editTitle);
                      setEditingId(null);
                    }}
                    style={{ flex: 1, background: "transparent", border: "none", color: "white", outline: "none" }}
                  />
                </div>
              ) : (
                <>
                  <button
                    className="orion-history-item"
                    type="button"
                    aria-pressed={chat.id === activeSessionId}
                    onClick={() => selectSession(chat.id)}
                    style={{ flex: 1, paddingRight: "50px" }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="orion-history-icon">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    <span className="orion-history-title" title={chat.title}>{chat.title}</span>
                  </button>
                  <div style={{ position: "absolute", right: "8px", display: "flex", gap: "4px" }}>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setEditTitle(chat.title); setEditingId(chat.id); }}
                      style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "2px" }}
                      title="Renombrar"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); if(window.confirm("¿Eliminar este chat?")) deleteSession(chat.id); }}
                      style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "2px" }}
                      title="Eliminar"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
