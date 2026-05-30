import { useEffect, useState, useRef } from "react";
import {
  fetchCandidateChecklist,
  uploadCandidateDocument,
  reviewCandidateDocument,
  type CandidateChecklistResult,
  type CandidateDocumentRow
} from "../services/hiringControl";
import { formatDateValue } from "./hiringControlViewUtils";
import { supabase } from "../../../shared/lib/supabase";

type CandidateDocumentChecklistProps = {
  caseCandidateId: string;
};

export function CandidateDocumentChecklist({ caseCandidateId }: CandidateDocumentChecklistProps) {
  const [checklist, setChecklist] = useState<CandidateChecklistResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedDocForUpload, setSelectedDocForUpload] = useState<CandidateDocumentRow | null>(null);

  async function loadChecklist() {
    setIsLoading(true);
    setErrorMsg("");
    const { data, error } = await fetchCandidateChecklist(caseCandidateId);
    if (error) {
      setErrorMsg(error);
    } else if (data) {
      setChecklist(data);
    }
    setIsLoading(false);
  }

  useEffect(() => {
    void loadChecklist();
  }, [caseCandidateId]);

  async function handleRealUploadStart(doc: CandidateDocumentRow) {
    setSelectedDocForUpload(doc);
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selectedDocForUpload) return;
    
    // Limpiar input
    e.target.value = "";

    if (isUploading) return;
    setIsUploading(true);
    setUploadError("");
    
    try {
      let expiryToUse = null;
      if (selectedDocForUpload.requires_expiry_date) {
        const input = window.prompt("Ingresa la fecha de vencimiento (YYYY-MM-DD):");
        if (!input) {
          throw new Error("Fecha de vencimiento es obligatoria para este documento.");
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) {
          throw new Error("Formato de fecha inválido. Usa YYYY-MM-DD.");
        }
        expiryToUse = input;
      }

      // 1. Upload to Supabase Storage
      if (!supabase) throw new Error("Cliente Supabase no configurado");
      
      const fileExt = file.name.split('.').pop() || "pdf";
      const fileName = `${selectedDocForUpload.document_type_id}_${Date.now()}.${fileExt}`;
      const storagePath = `${caseCandidateId}/${fileName}`;

      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('candidate-docs')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadErr) throw new Error(`Error subiendo archivo: ${uploadErr.message}`);
      if (!uploadData) throw new Error("No se devolvió path de subida");

      // 2. Call RPC
      const { error: rpcError } = await uploadCandidateDocument({
        caseCandidateId,
        documentTypeId: selectedDocForUpload.document_type_id,
        filePath: uploadData.path,
        expiryDate: expiryToUse
      });

      if (rpcError) throw new Error(`Error en base de datos: ${rpcError}`);

      await loadChecklist();
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Error desconocido al subir");
    } finally {
      setIsUploading(false);
      setSelectedDocForUpload(null);
    }
  }

  async function handleDownload(doc: CandidateDocumentRow) {
    if (!doc.file_path) return;
    if (!supabase) {
      alert("Cliente Supabase no configurado");
      return;
    }
    
    const { data, error } = await supabase.storage
      .from('candidate-docs')
      .createSignedUrl(doc.file_path, 3600); // 1 hora de validez

    if (error) {
      alert(`Error obteniendo enlace: ${error.message}`);
    } else if (data) {
      window.open(data.signedUrl, '_blank');
    }
  }

  async function handleReview(docId: string, status: "approved" | "rejected") {
    const notes = window.prompt(`Ingresa notas para la revisión (${status}):`);
    if (notes === null) return; // Cancelled
    
    const { error } = await reviewCandidateDocument({
      documentId: docId,
      status,
      notes
    });

    if (error) {
      alert(error);
    } else {
      await loadChecklist();
    }
  }

  if (isLoading && !checklist) {
    return <div className="control-detail-body"><p className="tracking-filter-caption">Cargando control documental...</p></div>;
  }

  if (errorMsg) {
    return <div className="control-detail-body"><p className="form-status">{errorMsg}</p></div>;
  }

  if (!checklist) {
    return null;
  }

  const semaphoreClass = `semaphore-indicator semaphore-${checklist.semaphore}`;
  const semaphoreText = {
    green: "Aprobado (Listo para contratar)",
    yellow: "En Revisión / Faltan No Críticos",
    red: "Bloqueado (Faltan Críticos o Vencidos)",
    gray: "Sin Iniciar"
  }[checklist.semaphore];

  return (
    <div className="control-detail-body document-checklist-container">
      <div className="document-semaphore-banner">
        <div className={semaphoreClass}></div>
        <span><strong>Estado Documental:</strong> {semaphoreText}</span>
      </div>

      {uploadError && <p className="form-status">{uploadError}</p>}

      <input 
        type="file" 
        ref={fileInputRef} 
        style={{ display: 'none' }} 
        onChange={(e) => void handleFileChange(e)} 
        accept=".pdf,.png,.jpg,.jpeg"
      />

      <div className="document-grid">
        {checklist.documents.map((doc) => (
          <div key={doc.document_type_id} className={`document-row document-status-${doc.status}`}>
            <div className="document-info">
              <span className="document-name">
                {doc.name} {doc.is_critical && <span className="critical-badge">*Crítico</span>}
              </span>
              <span className="document-meta">
                Estado: {doc.status} 
                {doc.expiry_date && ` · Vence: ${formatDateValue(doc.expiry_date)}`}
                {doc.reviewer_notes && ` · Nota: ${doc.reviewer_notes}`}
              </span>
            </div>
            
            <div className="document-actions">
              {doc.file_path ? (
                <button 
                  type="button" 
                  className="soft-primary-button soft-primary-button-neutral"
                  onClick={() => void handleDownload(doc)}
                >
                  Ver
                </button>
              ) : null}

              {doc.status === "pending" || doc.status === "rejected" || doc.status === "expired" ? (
                <button 
                  type="button" 
                  className="soft-primary-button soft-primary-button-neutral"
                  onClick={() => void handleRealUploadStart(doc)}
                  disabled={isUploading}
                >
                  {isUploading && selectedDocForUpload?.document_type_id === doc.document_type_id ? "Subiendo..." : "Cargar"}
                </button>
              ) : null}

              {doc.status === "uploaded" ? (
                <>
                  <button 
                    type="button" 
                    className="soft-primary-button soft-primary-button-success"
                    onClick={() => void handleReview(doc.id, "approved")}
                  >
                    Aprobar
                  </button>
                  <button 
                    type="button" 
                    className="soft-primary-button soft-primary-button-danger"
                    onClick={() => void handleReview(doc.id, "rejected")}
                  >
                    Rechazar
                  </button>
                </>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
