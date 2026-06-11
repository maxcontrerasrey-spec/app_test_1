import React, { useEffect, useState } from "react";
import { SearchableSelectField as SelectField } from "../../../shared/ui/forms/SearchableSelectField";
import {
  decideHiringApproval,
  toTravelMethodologyLabel,
  travelMethodologyOptions,
  type HiringApprovalDecision,
  type TravelMethodology
} from "../services/hiringWorkflow";

export type ApprovalModalData = {
  id: number;
  step_code?: string | null;
  step_name: string;
  approver_user_id: string | null;
  created_at: string | null;
  hiring_requests: {
    folio?: string | null;
    requester_name?: string | null;
    job_position_name?: string | null;
    contract_name?: string | null;
    vacancies?: number | null;
    requested_entry_date?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    shift_name?: string | null;
    other_benefits?: string | null;
    campamento?: boolean | null;
    pasajes?: boolean | null;
    travel_methodology?: string | null;
  } | null;
};

interface ApprovalModalProps {
  isOpen: boolean;
  approvalData: ApprovalModalData | null;
  currentUserId: string | undefined;
  isAdmin?: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ApprovalModal({
  isOpen,
  approvalData,
  currentUserId,
  isAdmin = false,
  onClose,
  onSuccess
}: ApprovalModalProps) {
  const [isDecisionLoading, setIsDecisionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [decisionMessage, setDecisionMessage] = useState("");
  const [travelMethodology, setTravelMethodology] = useState<TravelMethodology | "">("");

  useEffect(() => {
    if (!approvalData) {
      setErrorMessage("");
      setDecisionMessage("");
      setTravelMethodology("");
      return;
    }

    setErrorMessage("");
    setDecisionMessage("");
    setTravelMethodology(
      approvalData.hiring_requests?.travel_methodology === "travel_allowance" ||
      approvalData.hiring_requests?.travel_methodology === "company_purchase"
        ? approvalData.hiring_requests.travel_methodology
        : ""
    );
  }, [approvalData]);

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

    if (decision === "approved" && requiresTravelMethodology && !travelMethodology) {
      setErrorMessage("Debes definir la metodología de pasajes antes de aprobar.");
      return;
    }

    setIsDecisionLoading(true);
    setErrorMessage("");
    setDecisionMessage("");

    const result = await decideHiringApproval({
      approvalId: approvalData.id,
      decision,
      comment: null,
      travelMethodology:
        decision === "approved" && approvalData.step_code === "contracts_control"
          ? travelMethodology || null
          : null
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
  const requiresTravelMethodology =
    approvalData.step_code === "contracts_control" && hr?.pasajes === true;

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

        <div className="approval-detail-note">
          <small>Metodología de pasajes</small>
          <strong>
            {hr?.pasajes
              ? toTravelMethodologyLabel(hr?.travel_methodology)
              : "No aplica"}
          </strong>
        </div>

        {requiresTravelMethodology ? (
          <SelectField
            id="approval-travel-methodology"
            label="Metodología de pasajes"
            value={travelMethodology}
            onChange={(event) =>
              setTravelMethodology(event.target.value as TravelMethodology | "")
            }
            options={[...travelMethodologyOptions]}
            placeholder="Selecciona una metodología"
            disabled={isDecisionLoading}
          />
        ) : null}

        {errorMessage ? <p className="form-status form-status-error">{errorMessage}</p> : null}
        {decisionMessage ? <p className="form-status">{decisionMessage}</p> : null}

        {approvalData.approver_user_id === currentUserId || isAdmin ? (
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
