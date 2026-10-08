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
    status?: string | null;
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
    accommodation_type?: "pension" | "mining_camp" | null;
    pasajes?: boolean | null;
    travel_methodology?: string | null;
    travel_allowance_amount?: number | null;
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
  const [travelAllowanceAmount, setTravelAllowanceAmount] = useState("");

  useEffect(() => {
    if (!approvalData) {
      setErrorMessage("");
      setDecisionMessage("");
      setTravelMethodology("");
      setTravelAllowanceAmount("");
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
    setTravelAllowanceAmount(
      approvalData.hiring_requests?.travel_allowance_amount == null
        ? ""
        : String(approvalData.hiring_requests.travel_allowance_amount)
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

    if (
      decision === "approved" &&
      requiresTravelAllowanceAmount &&
      (!/^\d+$/.test(travelAllowanceAmount) || Number(travelAllowanceAmount) <= 0)
    ) {
      setErrorMessage("Ingresa un monto de bono de traslado mayor a cero.");
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
          : null,
      travelAllowanceAmount:
        decision === "approved" && requiresTravelAllowanceAmount
          ? Number(travelAllowanceAmount)
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
  const requiresTravelAllowanceAmount =
    requiresTravelMethodology && travelMethodology === "travel_allowance";
  const canViewOtherBenefits =
    ["area_manager", "contracts_control"].includes(approvalData.step_code ?? "") &&
    ["pending_area_manager", "pending_contracts_control"].includes(hr?.status ?? "") &&
    (approvalData.approver_user_id === currentUserId || isAdmin);

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
          <div className="approval-detail-item approval-detail-item-regular">
            <small>Solicitó</small>
            <strong>{hr?.requester_name ?? "No disponible"}</strong>
          </div>
          <div className="approval-detail-item approval-detail-item-xwide">
            <small>Cargo solicitado</small>
            <strong>{hr?.job_position_name ?? "No disponible"}</strong>
          </div>
          <div className="approval-detail-item approval-detail-item-wide">
            <small>Contrato</small>
            <strong>{hr?.contract_name ?? "No disponible"}</strong>
          </div>
          <div className="approval-detail-item approval-detail-item-tiny">
            <small>Vacantes</small>
            <strong>{hr?.vacancies ?? 0}</strong>
          </div>
          <div className="approval-detail-item approval-detail-item-wide">
            <small>Ingreso solicitado</small>
            <strong>{formatDateValue(hr?.requested_entry_date)}</strong>
          </div>
          <div className="approval-detail-item approval-detail-item-compact">
            <small>Turno</small>
            <strong>{hr?.shift_name ?? "No disponible"}</strong>
          </div>
          {hr?.campamento ? (
            <div className="approval-detail-item approval-detail-item-compact">
              <small>Tipo de alojamiento</small>
              <strong>
                {hr.accommodation_type === "pension"
                  ? "Pensión"
                  : hr.accommodation_type === "mining_camp"
                    ? "Campamento Minero"
                    : "No especificado"}
              </strong>
            </div>
          ) : null}
          <div className="approval-detail-item approval-detail-item-compact">
            <small>Creado</small>
            <strong>{formatDateTimeValue(approvalData.created_at)}</strong>
          </div>
        </div>

        {canViewOtherBenefits ? (
          <div className="approval-detail-note">
            <small>Otros beneficios</small>
            <strong>{hr?.other_benefits?.trim() || "Sin beneficios adicionales registrados"}</strong>
          </div>
        ) : null}

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

        {requiresTravelAllowanceAmount ? (
          <div className="field-group">
            <label className="field-label" htmlFor="approval-travel-allowance-amount">
              Monto del bono de traslado (CLP)
            </label>
            <input
              id="approval-travel-allowance-amount"
              className="text-field"
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              value={travelAllowanceAmount}
              onChange={(event) => setTravelAllowanceAmount(event.target.value)}
              disabled={isDecisionLoading}
            />
          </div>
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
