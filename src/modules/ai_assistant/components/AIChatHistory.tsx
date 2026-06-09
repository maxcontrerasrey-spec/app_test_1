export function AIChatHistory() {
  const mockHistory = [
    { id: "1", title: "Resumen Contrato Operaciones", date: "Hoy" },
    { id: "2", title: "Pregunta Reglamento Interno", date: "Hoy" },
    { id: "3", title: "Redacción Carta Amonestación", date: "Ayer" },
    { id: "4", title: "Procedimiento de Lavado Buses", date: "Ayer" },
    { id: "5", title: "Revisión Factura #4459", date: "Semana Pasada" },
  ];

  return (
    <aside className="orion-history-panel">
      <div className="orion-history-header">
        <button className="orion-new-chat-btn" aria-label="Nueva conversación">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Nuevo Chat
        </button>
      </div>

      <div className="orion-history-list">
        <div className="orion-history-group">
          <span className="orion-history-label">Recientes</span>
          {mockHistory.map((chat) => (
            <button key={chat.id} className="orion-history-item">
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
