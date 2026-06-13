import { useEffect, useState } from "react";

type IncentiveActionModalProps = {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  isSubmitting?: boolean;
  requireComment?: boolean;
  commentLabel?: string;
  commentPlaceholder?: string;
  defaultComment?: string;
  onClose: () => void;
  onConfirm: (comment: string) => Promise<void> | void;
};

export function IncentiveActionModal({
  isOpen,
  title,
  description,
  confirmLabel,
  isSubmitting = false,
  requireComment = false,
  commentLabel = "Comentario",
  commentPlaceholder = "Agrega contexto para dejar trazabilidad.",
  defaultComment = "",
  onClose,
  onConfirm
}: IncentiveActionModalProps) {
  const [comment, setComment] = useState(defaultComment);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setComment(defaultComment);
    setErrorMessage("");
  }, [defaultComment, isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleConfirm = async () => {
    const normalizedComment = comment.trim();

    if (requireComment && !normalizedComment) {
      setErrorMessage("Debes ingresar un comentario para continuar.");
      return;
    }

    setErrorMessage("");
    await onConfirm(normalizedComment);
  };

  return (
    <div className="approval-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="approval-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="incentive-action-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="home-section-header">
          <div>
            <h3 id="incentive-action-modal-title">{title}</h3>
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

        <div className="field-group">
          <label className="field-label" htmlFor="incentive-action-comment">
            {commentLabel}
          </label>
          <textarea
            id="incentive-action-comment"
            className="text-field"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            disabled={isSubmitting}
            rows={4}
            placeholder={commentPlaceholder}
          />
        </div>

        {errorMessage ? <p className="form-status form-status-error">{errorMessage}</p> : null}

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
            className="soft-primary-button approval-button-approve"
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
