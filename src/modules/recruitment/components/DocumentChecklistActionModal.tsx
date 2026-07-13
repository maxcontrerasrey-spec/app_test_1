import { useEffect, useState } from "react";
import type { CandidateDocumentRow } from "../services/documentChecklistApi";

type DocumentChecklistActionModalProps = {
  isOpen: boolean;
  mode: "upload" | "review" | "approve_validation" | "delete";
  title: string;
  description: string;
  confirmLabel: string;
  isSubmitting?: boolean;
  document?: CandidateDocumentRow | null;
  defaultNotes?: string;
  requireExpiryDate?: boolean;
  requireNotes?: boolean;
  onClose: () => void;
  onConfirm: (payload: { notes: string; expiryDate: string | null }) => Promise<void> | void;
};

export function DocumentChecklistActionModal({
  isOpen,
  mode,
  title,
  description,
  confirmLabel,
  isSubmitting = false,
  document = null,
  defaultNotes = "",
  requireExpiryDate = false,
  requireNotes = false,
  onClose,
  onConfirm
}: DocumentChecklistActionModalProps) {
  const [notes, setNotes] = useState(defaultNotes);
  const [expiryDate, setExpiryDate] = useState("");
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setNotes(defaultNotes);
    setExpiryDate("");
    setLocalError("");
  }, [defaultNotes, isOpen, mode]);

  if (!isOpen) {
    return null;
  }

  const handleConfirm = async () => {
    const normalizedNotes = notes.trim();
    const normalizedExpiryDate = expiryDate.trim();

    if (requireExpiryDate && !normalizedExpiryDate) {
      setLocalError("La fecha de vencimiento es obligatoria para este documento.");
      return;
    }

    if (normalizedExpiryDate && !/^\d{4}-\d{2}-\d{2}$/.test(normalizedExpiryDate)) {
      setLocalError("El formato de fecha debe ser YYYY-MM-DD.");
      return;
    }

    if (requireNotes && !normalizedNotes) {
      setLocalError("Debes registrar una observacion para continuar.");
      return;
    }

    setLocalError("");
    await onConfirm({
      notes: normalizedNotes,
      expiryDate: normalizedExpiryDate || null
    });
  };

  return (
    <div className="approval-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="approval-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="document-checklist-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="home-section-header">
          <div>
            <h3 id="document-checklist-modal-title">{title}</h3>
            <p>{description}</p>
          </div>
          <button
            type="button"
            className="soft-primary-button approval-button-detail"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cerrar
          </button>
        </div>

        {document ? (
          <div className="approval-detail-note">
            <small>Documento</small>
            <strong>{document.name}</strong>
          </div>
        ) : null}

        {requireExpiryDate ? (
          <div className="field-group">
            <label className="field-label" htmlFor="document-expiry-date">
              Fecha de vencimiento
            </label>
            <input
              id="document-expiry-date"
              className="text-field"
              type="date"
              value={expiryDate}
              onChange={(event) => setExpiryDate(event.target.value)}
              disabled={isSubmitting}
            />
          </div>
        ) : null}

        <div className="field-group">
          <label className="field-label" htmlFor="document-review-notes">
            {mode === "approve_validation" ? "Comentario de validacion" : "Observaciones"}
          </label>
          <textarea
            id="document-review-notes"
            className="text-field"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            disabled={isSubmitting}
            rows={4}
            placeholder="Agrega contexto para dejar trazabilidad."
          />
        </div>

        {localError ? <p className="form-status form-status-error">{localError}</p> : null}

        <div className="approval-action-row approval-action-row-detail">
          <button
            type="button"
            className="soft-primary-button approval-button-detail"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancelar
          </button>
          <button
            type="button"
            className={`soft-primary-button ${mode === "delete" ? "approval-button-reject" : "approval-button-approve"}`}
            onClick={() => void handleConfirm()}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Procesando..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
