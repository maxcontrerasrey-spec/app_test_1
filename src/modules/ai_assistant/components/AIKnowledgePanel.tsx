import { useState, useRef, useEffect } from "react";
import { useAuth } from "../../auth/context/AuthContext";
import {
  orionKnowledgeService,
  type OrionKnowledgeDocument
} from "../services/orionKnowledge";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function AIKnowledgePanel() {
  const { isSuperAdmin } = useAuth();
  const [docs, setDocs] = useState<OrionKnowledgeDocument[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadDocs() {
      const loadedDocs = await orionKnowledgeService.listDocuments();
      setDocs(loadedDocs);
    }
    loadDocs();
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const tempId = `temp-${Date.now()}`;
    const cleanName = file.name;

    setDocs((prev) => [
      {
        id: tempId,
        storagePath: tempId,
        name: cleanName,
        type: cleanName.toLowerCase().endsWith(".pdf") ? "pdf" : "docx",
        sizeLabel: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
        status: "Subiendo..."
      },
      ...prev
    ]);

    try {
      const uploadedDocument = await orionKnowledgeService.uploadDocument(file);
      setDocs((prev) =>
        prev.map((d) =>
          d.id === tempId
            ? { ...uploadedDocument, status: "Procesando..." }
            : d
        )
      );

      await orionKnowledgeService.processDocument(uploadedDocument.storagePath);

      setDocs((prev) =>
        prev.map((d) => (d.storagePath === uploadedDocument.storagePath ? { ...d, status: "Procesado" } : d))
      );
    } catch (error) {
      setDocs((prev) =>
        prev.map((d) =>
          d.id === tempId
            ? { ...d, status: `Error: ${getErrorMessage(error, "Fallo en procesamiento")}` }
            : d
        )
      );
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDeleteDoc = async (document: OrionKnowledgeDocument) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar el documento "${document.name}"?`)) return;

    setDocs((prev) =>
      prev.map((item) =>
        item.storagePath === document.storagePath ? { ...item, status: "Eliminando..." } : item
      )
    );

    try {
      await orionKnowledgeService.deleteDocument(document.storagePath);
      setDocs((prev) => prev.filter((item) => item.storagePath !== document.storagePath));
    } catch (error) {
      alert(`Error al eliminar: ${getErrorMessage(error, "No se pudo eliminar el documento")}`);
      setDocs((prev) =>
        prev.map((item) =>
          item.storagePath === document.storagePath ? { ...item, status: "Procesado" } : item
        )
      );
    }
  };

  return (
    <aside className="orion-knowledge-panel">
      <div className="orion-knowledge-header">
        <h3>Base de Conocimiento</h3>
        <p>Documentos que alimentan a ORION.</p>
      </div>

      {isSuperAdmin && (
        <div 
          className={`orion-upload-zone ${isUploading ? "orion-upload-zone-disabled" : ""}`}
          aria-label="Subir documento"
          onClick={() => !isUploading && fileInputRef.current?.click()}
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept=".pdf,.doc,.docx" 
            className="orion-hidden-file-input"
            disabled={isUploading}
          />
          {isUploading ? (
            <div className="orion-spinner orion-upload-spinner"></div>
          ) : (
            <svg className="orion-upload-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          )}
          <span className="orion-upload-text">
            {isUploading ? "Procesando archivo..." : "Subir Documento"}
          </span>
          <span className="orion-upload-hint">Solo Admins: Haz clic para subir PDF o Word</span>
        </div>
      )}

      <div className="orion-doc-list">
        {docs.map((doc) => (
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
              <span className={`orion-doc-meta ${doc.status.includes("Error") ? "orion-doc-meta-error" : ""}`}>
                {doc.sizeLabel} · {doc.status}
              </span>
            </div>
            {isSuperAdmin && (
              <button
                onClick={() => handleDeleteDoc(doc)}
                className="orion-doc-delete-btn"
                title="Eliminar documento"
                disabled={doc.status.includes("Procesando") || doc.status.includes("Eliminando")}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            )}
          </div>
        ))}
        {docs.length === 0 && (
          <div className="orion-doc-empty-state">
            No hay documentos cargados.
          </div>
        )}
      </div>
    </aside>
  );
}
