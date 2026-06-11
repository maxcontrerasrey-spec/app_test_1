import React, { useState, useMemo } from "react";
import { TextField } from "../../../shared/ui/forms/TextField";
import { SearchableSelectField as SelectField } from "../../../shared/ui/forms/SearchableSelectField";
import {
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

  const availableCases = useMemo(() => {
    if (!candidate) return [];
    return activeCases.filter(
      (c) =>
        c.id !== candidate.recruitment_case_id &&
        !["filled", "closed_unfilled", "cancelled"].includes(c.status)
    );
  }, [activeCases, candidate]);

  if (!isOpen || !candidate) return null;

  const handleTransfer = async () => {
    if (!targetCaseId) {
      setErrorMessage("Debes seleccionar un folio destino.");
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    const result = await transferCandidateToCase({
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
            <h3 id="transfer-modal-title">Trasladar Candidato</h3>
            <p>
              Trasladar a <strong>{candidate.full_name}</strong> de {candidate.case_code} a otro folio activo.
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
            label="Folio destino"
            value={targetCaseId}
            onChange={(e) => setTargetCaseId(e.target.value)}
            options={caseOptions}
            placeholder="Seleccionar folio destino..."
            disabled={isLoading || caseOptions.length === 0}
          />
          {caseOptions.length === 0 && (
            <p className="tracking-filter-caption" style={{ marginTop: "-1rem", marginBottom: "1rem" }}>
              No hay otros folios activos disponibles para trasladar.
            </p>
          )}

          <TextField
            id="transfer-comment"
            label="Motivo del traslado (Opcional)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Ej. El folio original se cerró..."
            disabled={isLoading}
          />

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
              Confirmar Traslado
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
