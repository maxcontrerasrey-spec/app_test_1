import { useEffect, useState, useRef } from "react";
import {
  fetchCandidateChecklist,
  uploadCandidateDocument,
  reviewCandidateDocument,
  approveCandidateDocumentation,
  type CandidateChecklistResult,
  type CandidateDocumentRow
} from "../services/documentChecklistApi";
import { formatDateValue } from "./hiringControlViewUtils";
import { supabase } from "../../../shared/lib/supabase";
import { DocumentChecklistActionModal } from "./DocumentChecklistActionModal";

type ChecklistModalState =
  | { mode: "closed" }
  | { mode: "upload"; document: CandidateDocumentRow }
  | { mode: "review"; document: CandidateDocumentRow; status: "approved" | "rejected" }
  | { mode: "approve_validation" };

type CandidateDocumentChecklistProps = {
  caseCandidateId: string;
  onChecklistUpdated?: () => Promise<void>;
};

export function CandidateDocumentChecklist({
  caseCandidateId,
  onChecklistUpdated
}: CandidateDocumentChecklistProps) {
  const [checklist, setChecklist] = useState<CandidateChecklistResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [isApprovingValidation, setIsApprovingValidation] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedDocForUpload, setSelectedDocForUpload] = useState<CandidateDocumentRow | null>(null);
  const [pendingUploadFile, setPendingUploadFile] = useState<File | null>(null);
  const [modalState, setModalState] = useState<ChecklistModalState>({ mode: "closed" });

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

    if (isUploading) return;
    setUploadError("");
    const requiresExpiryDate = selectedDocForUpload.requires_expiry_date;

    try {
      if (requiresExpiryDate) {
        setPendingUploadFile(file);
        setModalState({ mode: "upload", document: selectedDocForUpload });
        return;
      }

      setIsUploading(true);
      await persistUploadedDocument(selectedDocForUpload, file, null);
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Error desconocido al subir");
    } finally {
      e.target.value = "";
      setIsUploading(false);
      if (!requiresExpiryDate) {
        setPendingUploadFile(null);
        setSelectedDocForUpload(null);
      }
    }
  }

  async function persistUploadedDocument(
    document: CandidateDocumentRow,
    file: File,
    expiryDate: string | null
  ) {
    if (!supabase) throw new Error("Cliente Supabase no configurado");

    const fileExt = file.name.split(".").pop() || "pdf";
    const fileName = `${document.document_type_id}_${Date.now()}.${fileExt}`;
    const storagePath = `${caseCandidateId}/${fileName}`;

    const { data: uploadData, error: uploadErr } = await supabase.storage
      .from("candidate-docs")
      .upload(storagePath, file, {
        cacheControl: "3600",
        upsert: true
      });

    if (uploadErr) throw new Error(`Error subiendo archivo: ${uploadErr.message}`);
    if (!uploadData) throw new Error("No se devolvio path de subida");

    const { error: rpcError } = await uploadCandidateDocument({
      caseCandidateId,
      documentTypeId: document.document_type_id,
      filePath: uploadData.path,
      expiryDate
    });

    if (rpcError) throw new Error(`Error en base de datos: ${rpcError}`);

    await loadChecklist();
    await onChecklistUpdated?.();
  }

  async function handleDownload(doc: CandidateDocumentRow) {
    if (!doc.file_path) return;
    if (!supabase) {
      setUploadError("Cliente Supabase no configurado");
      return;
    }
    
    const { data, error } = await supabase.storage
      .from('candidate-docs')
      .createSignedUrl(doc.file_path, 3600); // 1 hora de validez

    if (error) {
      setUploadError(`Error obteniendo enlace: ${error.message}`);
    } else if (data) {
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    }
  }

  async function submitReview(
    docId: string,
    status: "approved" | "rejected",
    notes: string
  ) {
    const { error } = await reviewCandidateDocument({
      documentId: docId,
      status,
      notes
    });

    if (error) {
      setUploadError(error);
      return false;
    }

    await loadChecklist();
    await onChecklistUpdated?.();
    return true;
  }

  async function submitApproveValidation(notes: string) {
    setIsApprovingValidation(true);
    setUploadError("");

    try {
      const { error } = await approveCandidateDocumentation({
        caseCandidateId,
        comment: notes
      });

      if (error) {
        throw new Error(error);
      }

      await loadChecklist();
      await onChecklistUpdated?.();
      return true;
    } catch (err: unknown) {
      setUploadError(
        err instanceof Error
          ? err.message
          : "No fue posible aprobar la revisión documental."
      );
      return false;
    } finally {
      setIsApprovingValidation(false);
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
  const documentValidation = checklist.document_validation;
  const documentValidationApproved = documentValidation.status === "approved";

  return (
    <div className="control-detail-body document-checklist-container">
      <div className="document-semaphore-banner">
        <div className={semaphoreClass}></div>
        <span><strong>Estado Documental:</strong> {semaphoreText}</span>
      </div>

      <div className="approval-detail-note">
        <small>Revisión documental previa a contratación</small>
        <strong>
          {documentValidationApproved
            ? "Aprobada para pasar a contratación"
            : "Pendiente de aprobación final"}
        </strong>

        <div className="document-validation-metrics">
          <span>
            Documentos obligatorios aprobados: {checklist.required_documents_approved}/
            {checklist.required_documents_total}
          </span>
          <span>Perfil evaluado como: {checklist.candidate_group === "conductor" ? "Conductor" : "Otros"}</span>
        </div>

        {documentValidationApproved ? (
          <div className="document-validation-summary">
            <span>
              Validado por: {documentValidation.validated_by_name ?? "No disponible"}
            </span>
            <span>
              Fecha: {formatDateValue(documentValidation.validated_at)}
            </span>
            {documentValidation.comment ? (
              <p className="control-comment-text">{documentValidation.comment}</p>
            ) : null}
          </div>
        ) : (
          <>
            {!checklist.worker_file_complete ? (
              <p className="document-validation-warning">
                Es necesario completar la ficha del candidato y cargar la documentación.
              </p>
            ) : null}

            {checklist.required_documents_approved < checklist.required_documents_total ? (
              <p className="document-validation-warning">
                Aún faltan documentos obligatorios aprobados para habilitar la contratación.
              </p>
            ) : null}

            <div className="document-validation-actions">
              <button
                type="button"
                className="soft-primary-button approval-button-approve"
                disabled={
                  isApprovingValidation ||
                  !checklist.worker_file_complete ||
                  checklist.required_documents_approved < checklist.required_documents_total ||
                  checklist.semaphore !== "green"
                }
                onClick={() => setModalState({ mode: "approve_validation" })}
              >
                {isApprovingValidation
                  ? "Aprobando revisión..."
                  : "Aprobar revisión documental"}
              </button>
            </div>
          </>
        )}
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
                {doc.name}{" "}
                <span className={doc.is_required ? "required-badge" : "optional-badge"}>
                  {doc.is_required ? "Obligatorio" : "Opcional"}
                </span>
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
                  className="soft-primary-button soft-primary-button-sm soft-primary-button-neutral"
                  onClick={() => void handleDownload(doc)}
                >
                  Ver
                </button>
              ) : null}

              {doc.status === "pending" || doc.status === "rejected" || doc.status === "expired" ? (
                <button 
                  type="button" 
                  className="soft-primary-button soft-primary-button-sm soft-primary-button-neutral"
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
                    className="soft-primary-button soft-primary-button-sm soft-primary-button-success"
                    onClick={() => setModalState({ mode: "review", document: doc, status: "approved" })}
                  >
                    Aprobar
                  </button>
                  <button 
                    type="button" 
                    className="soft-primary-button soft-primary-button-sm soft-primary-button-danger"
                    onClick={() => setModalState({ mode: "review", document: doc, status: "rejected" })}
                  >
                    Rechazar
                  </button>
                </>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <DocumentChecklistActionModal
        isOpen={modalState.mode === "upload"}
        mode="upload"
        title="Completar carga documental"
        description="Registra la metadata obligatoria antes de guardar el archivo."
        confirmLabel="Guardar documento"
        isSubmitting={isUploading}
        document={modalState.mode === "upload" ? modalState.document : null}
        requireExpiryDate={modalState.mode === "upload" ? modalState.document.requires_expiry_date : false}
        onClose={() => {
          if (!isUploading) {
            setModalState({ mode: "closed" });
            setPendingUploadFile(null);
            setSelectedDocForUpload(null);
          }
        }}
        onConfirm={async ({ expiryDate }) => {
          const pendingFile = pendingUploadFile;
          if (!pendingFile || !selectedDocForUpload) {
            setUploadError("No hay un archivo pendiente para cargar.");
            setModalState({ mode: "closed" });
            return;
          }

          setIsUploading(true);
          setUploadError("");

          try {
            await persistUploadedDocument(selectedDocForUpload, pendingFile, expiryDate);
            setModalState({ mode: "closed" });
          } catch (err: unknown) {
            setUploadError(err instanceof Error ? err.message : "Error desconocido al subir");
          } finally {
            setIsUploading(false);
            setPendingUploadFile(null);
            setSelectedDocForUpload(null);
            if (fileInputRef.current) {
              fileInputRef.current.value = "";
            }
          }
        }}
      />

      <DocumentChecklistActionModal
        isOpen={modalState.mode === "review"}
        mode="review"
        title={modalState.mode === "review" && modalState.status === "approved" ? "Aprobar documento" : "Rechazar documento"}
        description="Registra observaciones de revision para dejar trazabilidad auditada."
        confirmLabel={modalState.mode === "review" && modalState.status === "approved" ? "Confirmar aprobacion" : "Confirmar rechazo"}
        document={modalState.mode === "review" ? modalState.document : null}
        requireNotes
        onClose={() => setModalState({ mode: "closed" })}
        onConfirm={async ({ notes }) => {
          if (modalState.mode !== "review") {
            return;
          }
          const wasSuccessful = await submitReview(
            modalState.document.id,
            modalState.status,
            notes
          );
          if (wasSuccessful) {
            setModalState({ mode: "closed" });
          }
        }}
      />

      <DocumentChecklistActionModal
        isOpen={modalState.mode === "approve_validation"}
        mode="approve_validation"
        title="Aprobar revision documental"
        description="Registra un comentario de cierre antes de habilitar la contratacion."
        confirmLabel="Aprobar revision"
        isSubmitting={isApprovingValidation}
        requireNotes
        onClose={() => {
          if (!isApprovingValidation) {
            setModalState({ mode: "closed" });
          }
        }}
        onConfirm={async ({ notes }) => {
          const wasSuccessful = await submitApproveValidation(notes);
          if (wasSuccessful) {
            setModalState({ mode: "closed" });
          }
        }}
      />
    </div>
  );
}
