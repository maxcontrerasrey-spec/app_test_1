import { useState, useRef, useEffect } from "react";
import { useAuth } from "../../auth/context/AuthContext";
import { supabase } from "../../../shared/lib/supabase";

type OrionDoc = {
  id: string;
  name: string;
  type: string;
  size: string;
  status: string;
};

export function AIKnowledgePanel() {
  const { isSuperAdmin } = useAuth();
  const [docs, setDocs] = useState<OrionDoc[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadDocs() {
      const { data, error } = await supabase.storage.from("orion_knowledge").list();
      if (data && !error) {
        const loadedDocs = data
          .filter((f) => f.name !== ".emptyFolderPlaceholder")
          .map((f) => ({
            id: f.id || f.name,
            name: f.name.replace(/^\d+_/, ""), // Remove timestamp prefix
            type: f.name.toLowerCase().endsWith(".pdf") ? "pdf" : "docx",
            size: `${(f.metadata?.size / 1024 / 1024).toFixed(1)} MB`,
            status: "Procesado"
          }));
        setDocs(loadedDocs);
      }
    }
    loadDocs();
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const tempId = `temp-${Date.now()}`;
    const cleanName = file.name;
    const pathName = `${Date.now()}_${cleanName}`;

    setDocs((prev) => [
      {
        id: tempId,
        name: cleanName,
        type: cleanName.toLowerCase().endsWith(".pdf") ? "pdf" : "docx",
        size: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
        status: "Subiendo..."
      },
      ...prev
    ]);

    const { data, error } = await supabase.storage
      .from("orion_knowledge")
      .upload(pathName, file);

    if (error || !data) {
      console.error("Upload error", error);
      setDocs((prev) => prev.filter((d) => d.id !== tempId));
      setIsUploading(false);
      return;
    }

    setDocs((prev) =>
      prev.map((d) => (d.id === tempId ? { ...d, status: "Procesando..." } : d))
    );

    try {
      await supabase.functions.invoke("orion-document-processor", {
        body: { filePath: data.path }
      });
      setDocs((prev) =>
        prev.map((d) => (d.id === tempId ? { ...d, status: "Procesado" } : d))
      );
    } catch (err) {
      console.error("Processing error", err);
      setDocs((prev) =>
        prev.map((d) => (d.id === tempId ? { ...d, status: "Error al procesar" } : d))
      );
    }

    setIsUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
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
          className="orion-upload-zone" 
          aria-label="Subir documento"
          onClick={() => !isUploading && fileInputRef.current?.click()}
          style={{ cursor: isUploading ? "not-allowed" : "pointer", opacity: isUploading ? 0.7 : 1 }}
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept=".pdf,.doc,.docx" 
            style={{ display: "none" }} 
            disabled={isUploading}
          />
          {isUploading ? (
            <div className="orion-spinner" style={{ borderTopColor: "var(--accent)", width: 32, height: 32, borderWidth: 3 }}></div>
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
              <span className="orion-doc-meta" style={{ color: doc.status.includes("Error") ? "red" : "inherit" }}>
                {doc.size} · {doc.status}
              </span>
            </div>
          </div>
        ))}
        {docs.length === 0 && (
          <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem", padding: "1rem" }}>
            No hay documentos cargados.
          </div>
        )}
      </div>
    </aside>
  );
}
