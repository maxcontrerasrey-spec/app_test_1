import { useEffect, useState } from "react";
import {
  fetchCandidateChecklist,
  uploadCandidateDocument,
  reviewCandidateDocument,
  type CandidateChecklistResult,
  type CandidateDocumentRow
} from "../services/hiringControl";
import { formatDateValue } from "./hiringControlViewUtils";

type CandidateDocumentChecklistProps = {
  caseCandidateId: string;
};

export function CandidateDocumentChecklist({ caseCandidateId }: CandidateDocumentChecklistProps) {
  const [checklist, setChecklist] = useState<CandidateChecklistResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

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

  async function handleSimulatedUpload(doc: CandidateDocumentRow) {
    if (isUploading) return;
    setIsUploading(true);
    setUploadError("");
    
    // Simular uploader. En producción esto iría a Supabase Storage y obtendría un path.
    const fakePath = `/documents/${caseCandidateId}/${doc.document_type_id}/file.pdf`;
    const fakeExpiry = doc.requires_expiry_date ? "2028-01-01" : null;

    const { error } = await uploadCandidateDocument({
      caseCandidateId,
      documentTypeId: doc.document_type_id,
      filePath: fakePath,
      expiryDate: fakeExpiry
    });

    if (error) {
      setUploadError(error);
    } else {
      await loadChecklist();
    }
    setIsUploading(false);
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
              {doc.status === "pending" || doc.status === "rejected" || doc.status === "expired" ? (
                <button 
                  type="button" 
                  className="soft-primary-button soft-primary-button-neutral"
                  onClick={() => void handleSimulatedUpload(doc)}
                  disabled={isUploading}
                >
                  Cargar
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
