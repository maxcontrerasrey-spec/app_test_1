import React, { useEffect, useMemo, useState } from "react";
import { TextField } from "../../../shared/ui/forms/TextField";
import { SearchableSelectField as SelectField } from "../../../shared/ui/forms/SearchableSelectField";
import {
  addCandidateToRecruitmentCase,
  releaseCandidateWithoutFolio,
  transferCandidateToCase,
  type RecruitmentCandidateControlRow,
  type RecruitmentCaseListRow
} from "../services/hiringControl";

interface TransferCandidateModalProps {
  isOpen: boolean;
  candidate: RecruitmentCandidateControlRow | null;
  activeCases: RecruitmentCaseListRow[];
  onClose: () => void;
  onSuccess: () => void;
}

export function TransferCandidateModal({
  isOpen,
  candidate,
  activeCases,
  onClose,
  onSuccess
}: TransferCandidateModalProps) {
  const [targetCaseId, setTargetCaseId] = useState("");
  const [comment, setComment] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const isReactivation = candidate?.stage_code === "rejected" || candidate?.stage_code === "withdrawn";

  const availableCases = useMemo(() => {
    if (!candidate) return [];
    return activeCases.filter(
      (c) =>
        (isReactivation || c.id !== candidate.recruitment_case_id) &&
        !["filled", "closed_unfilled", "cancelled"].includes(c.status)
    );
  }, [activeCases, candidate, isReactivation]);

  useEffect(() => {
    if (!isOpen) {
      setIsLoading(false);
    }

    setTargetCaseId("");
    setComment("");
    setErrorMessage("");
  }, [candidate?.id, isOpen]);

  if (!isOpen || !candidate) return null;

  const handleTransfer = async () => {
    if (!targetCaseId) {
      setErrorMessage("Debes seleccionar un folio destino.");
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    const result = isReactivation
      ? await addCandidateToRecruitmentCase({
          caseId: targetCaseId,
          nationalId: candidate.national_id,
          fullName: candidate.full_name,
          email: candidate.email ?? undefined,
          phone: candidate.phone ?? undefined
        })
      : await transferCandidateToCase({
          caseCandidateId: candidate.id,
          targetCaseId,
          comment
        });

    if (result.error) {
      setErrorMessage(result.error);
      setIsLoading(false);
    } else {
      setIsLoading(false);
      onSuccess();
    }
  };

  const handleReleaseWithoutFolio = async () => {
    if (!candidate || candidate.is_without_folio) return;

    setIsLoading(true);
    setErrorMessage("");

    const result = await releaseCandidateWithoutFolio({
      caseCandidateId: candidate.id,
      comment
    });

    if (result.error) {
      setErrorMessage(result.error);
      setIsLoading(false);
      return;
    }

    setIsLoading(false);
    onSuccess();
  };

  const caseOptions = availableCases.map((c) => ({
    value: c.id,
    label: `${c.case_code} - ${c.job_position_name} (${c.contract_name})`
  }));

  return (
    <div className="approval-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="approval-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="transfer-modal-title"
        onClick={(event) => event.stopPropagation()}
        style={{ maxWidth: "500px" }}
      >
        <div className="home-section-header">
          <div>
            <h3 id="transfer-modal-title">
              {isReactivation ? "Reactivar candidato" : "Trasladar candidato"}
            </h3>
            <p>
              {isReactivation ? "Reiniciar el flujo de " : "Trasladar a "}
              <strong>{candidate.full_name}</strong>{
                candidate.is_without_folio || candidate.case_status === "filled" || candidate.case_status === "closed_unfilled"
                  ? ""
                  : candidate.case_code
                    ? isReactivation ? ` desde ${candidate.case_code}` : ` desde ${candidate.case_code}`
                    : ""
              } {isReactivation ? "desde Lead en el folio seleccionado." : "a otro folio activo."}
            </p>
            <p className="tracking-filter-caption">
              {isReactivation
                ? <>El rechazo original se conserva en el historial. También puedes dejarlo disponible en <strong>Sin Folio</strong>.</>
                : <>También puedes conservarlo en la nómina y dejarlo disponible en <strong>Sin Folio</strong>.</>}
            </p>
          </div>
          <button
            type="button"
            className="soft-primary-button approval-button-detail"
            onClick={onClose}
          >
            Cerrar
          </button>
        </div>

        <div className="form-layout" style={{ marginTop: "1.5rem" }}>
          <SelectField
            id="transfer-target-case"
            label={isReactivation ? "Reactivar en folio" : "Folio destino"}
            value={targetCaseId}
            onChange={(e) => setTargetCaseId(e.target.value)}
            options={caseOptions}
            placeholder="Seleccionar folio destino..."
            disabled={isLoading || caseOptions.length === 0}
          />
          {caseOptions.length === 0 && (
            <p className="tracking-filter-caption" style={{ marginTop: "-1rem", marginBottom: "1rem" }}>
              {isReactivation
                ? "No hay folios activos disponibles para reactivar al candidato."
                : "No hay otros folios activos disponibles para trasladar."}
            </p>
          )}

          {!isReactivation ? (
            <TextField
              id="transfer-comment"
              label="Motivo del traslado (Opcional)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Ej. El folio original se cerró..."
              disabled={isLoading}
            />
          ) : null}

          {errorMessage && <p className="form-status form-status-error">{errorMessage}</p>}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "1rem", marginTop: "1rem" }}>
            <button
              type="button"
              className="soft-primary-button"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={() => void handleTransfer()}
              disabled={isLoading || !targetCaseId}
            >
              {isReactivation ? "Confirmar reactivación" : "Confirmar traslado"}
            </button>
            <button
              type="button"
              className="soft-primary-button"
              onClick={() => void handleReleaseWithoutFolio()}
              disabled={isLoading || Boolean(candidate.is_without_folio)}
              title="Reiniciar el flujo y dejar al candidato disponible sin folio"
            >
              Dejar en Sin Folio
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
