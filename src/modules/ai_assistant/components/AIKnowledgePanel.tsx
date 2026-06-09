export function AIKnowledgePanel() {
  const mockDocs = [
    { id: "1", name: "Manual de Operaciones 2024.pdf", type: "pdf", size: "2.4 MB" },
    { id: "2", name: "Protocolo_Contratacion.docx", type: "docx", size: "1.1 MB" },
    { id: "3", name: "Reglamento Interno.pdf", type: "pdf", size: "4.8 MB" },
  ];

  return (
    <aside className="orion-knowledge-panel">
      <div className="orion-knowledge-header">
        <h3>Base de Conocimiento</h3>
        <p>Documentos que alimentan a ORION.</p>
      </div>

      <div className="orion-upload-zone" aria-label="Subir documento">
        <svg className="orion-upload-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <span className="orion-upload-text">Subir Documento</span>
        <span className="orion-upload-hint">Arrastra un PDF o Word aquí</span>
      </div>

      <div className="orion-doc-list">
        {mockDocs.map((doc) => (
          <div key={doc.id} className="orion-doc-item">
            <svg 
              className={`orion-doc-icon ${doc.type}`} 
              width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              {doc.type === "pdf" ? (
                <path d="M10 12v6M10 15h3" />
              ) : (
                <path d="M9 12h6M9 16h6" />
              )}
            </svg>
            <div className="orion-doc-info">
              <span className="orion-doc-name" title={doc.name}>{doc.name}</span>
              <span className="orion-doc-meta">{doc.size} · Procesado</span>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
