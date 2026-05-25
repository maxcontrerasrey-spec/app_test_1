import React, { useState } from "react";
import { decideHiringApproval, type HiringApprovalDecision } from "../services/hiringWorkflow";

interface ApprovalModalProps {
  isOpen: boolean;
  approvalData: any; // Ideally typed to HiringRequestApproval & { hiring_requests: HiringRequest }
  currentUserId: string | undefined;
  onClose: () => void;
  onSuccess: () => void;
}

export function ApprovalModal({
  isOpen,
  approvalData,
  currentUserId,
  onClose,
  onSuccess
}: ApprovalModalProps) {
  const [isDecisionLoading, setIsDecisionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [decisionMessage, setDecisionMessage] = useState("");

  if (!isOpen || !approvalData) return null;

  const formatDateValue = (val?: string | null) => {
    if (!val) return "No disponible";
    const d = new Date(val);
    return isNaN(d.getTime())
      ? "Fecha inválida"
      : d.toLocaleDateString("es-CL", { timeZone: "UTC" });
  };

  const formatDateTimeValue = (val?: string | null) => {
    if (!val) return "No disponible";
    const d = new Date(val);
    return isNaN(d.getTime())
      ? "Fecha inválida"
      : d.toLocaleString("es-CL", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
  };

  const handleApproval = async (decision: HiringApprovalDecision) => {
    if (!approvalData) return;
    setIsDecisionLoading(true);
    setErrorMessage("");
    setDecisionMessage("");

    const result = await decideHiringApproval({
      approvalId: approvalData.id,
      decision,
      comment: null,
    });

    if (result.error) {
      setErrorMessage(result.error);
      setIsDecisionLoading(false);
    } else {
      setDecisionMessage(decision === "approved" ? "Folio aprobado." : "Folio rechazado.");
      setTimeout(() => {
        setIsDecisionLoading(false);
        onSuccess();
      }, 1000);
    }
  };

  const hr = approvalData.hiring_requests;

  return (
    <div className="approval-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="approval-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="approval-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="home-section-header">
          <div>
            <h3 id="approval-modal-title">
              Folio {hr?.folio ?? "Sin folio"}
            </h3>
            <p>{approvalData.step_name}</p>
          </div>
          <button
            type="button"
            className="soft-primary-button approval-button-detail"
            onClick={onClose}
          >
            Cerrar
          </button>
        </div>

        <div className="approval-detail-grid">
          <div className="approval-detail-item approval-detail-item-tiny">
            <small>Solicitó</small>
            <strong>{hr?.requester_name ?? "No disponible"}</strong>
          </div>
          <div className="approval-detail-item approval-detail-item-wide">
            <small>Correo solicitante</small>
            <strong>{hr?.requester_email ?? "No disponible"}</strong>
          </div>
          <div className="approval-detail-item approval-detail-item-compact">
            <small>Cargo solicitado</small>
            <strong>{hr?.job_position_name ?? "No disponible"}</strong>
          </div>
          <div className="approval-detail-item approval-detail-item-regular">
            <small>Contrato</small>
            <strong>{hr?.contract_name ?? "No disponible"}</strong>
          </div>
          <div className="approval-detail-item approval-detail-item-tiny">
            <small>Vacantes</small>
            <strong>{hr?.vacancies ?? 0}</strong>
          </div>
          <div className="approval-detail-item approval-detail-item-tiny">
            <small>Ingreso solicitado</small>
            <strong>{formatDateValue(hr?.requested_entry_date)}</strong>
          </div>
          <div className="approval-detail-item approval-detail-item-tiny">
            <small>Inicio contrato</small>
            <strong>{formatDateValue(hr?.start_date)}</strong>
          </div>
          <div className="approval-detail-item approval-detail-item-tiny">
            <small>Fin contrato</small>
            <strong>{formatDateValue(hr?.end_date)}</strong>
          </div>
          <div className="approval-detail-item approval-detail-item-tiny">
            <small>Turno</small>
            <strong>{hr?.shift_name ?? "No disponible"}</strong>
          </div>
          <div className="approval-detail-item approval-detail-item-tiny">
            <small>Creado</small>
            <strong>{formatDateTimeValue(approvalData.created_at)}</strong>
          </div>
        </div>

        <div className="approval-detail-note">
          <small>Beneficios</small>
          <strong>
            {hr?.other_benefits?.trim() || hr?.campamento || hr?.pasajes
              ? [
                  hr?.campamento ? "Campamento" : null,
                  hr?.pasajes ? "Pasajes" : null,
                  hr?.other_benefits?.trim() || null,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : "Sin beneficios adicionales registrados"}
          </strong>
        </div>

        {errorMessage ? <p className="form-status form-status-error">{errorMessage}</p> : null}
        {decisionMessage ? <p className="form-status">{decisionMessage}</p> : null}

        {approvalData.approver_user_id === currentUserId ? (
          <div className="approval-action-row approval-action-row-detail">
            <button
              type="button"
              className="soft-primary-button approval-button-approve"
              disabled={isDecisionLoading}
              onClick={() => void handleApproval("approved")}
            >
              Aprobar folio
            </button>
            <button
              type="button"
              className="soft-primary-button approval-button-reject"
              disabled={isDecisionLoading}
              onClick={() => void handleApproval("rejected")}
            >
              Rechazar folio
            </button>
          </div>
        ) : (
          <div className="approval-detail-note">
            <small>Decisión</small>
            <strong>Solo el aprobador asignado puede decidir este folio.</strong>
          </div>
        )}
      </div>
    </div>
  );
}
