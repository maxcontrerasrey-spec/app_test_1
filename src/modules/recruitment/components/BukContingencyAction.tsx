import { useState } from "react";
import { TextField } from "../../../shared/ui/forms/TextField";
import { enqueueCandidatesToBukContingency } from "../services/hiringControl";

type BukContingencyActionProps = {
  candidateId: string;
};

export function BukContingencyAction({ candidateId }: BukContingencyActionProps) {
  const [reason, setReason] = useState(
    "Contingencia de contratación DSAL; regularización documental posterior."
  );
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleLoad = async () => {
    setIsLoading(true);
    setMessage("");
    const result = await enqueueCandidatesToBukContingency([candidateId], reason);
    setMessage(
      result.error
        ? result.error
        : result.dispatchError
          ? `Job encolado, pero la sincronización no inició: ${result.dispatchError}`
          : `Carga BUK iniciada. Job: ${result.data.map((job) => job.job_id).join(", ") || "pendiente"}.`
    );
    setIsLoading(false);
  };

  return (
    <div className="approval-detail-note control-block-top">
      <small>Carga BUK en contingencia DSAL</small>
      <TextField
        id="buk-contingency-reason"
        label="Motivo auditado"
        value={reason}
        disabled={isLoading}
        onChange={(event) => setReason(event.target.value)}
      />
      <div className="control-actions-row">
        <button
          type="button"
          className="soft-primary-button approval-button-approve control-compact-button control-compact-button-primary"
          disabled={isLoading || reason.trim().length < 10}
          onClick={handleLoad}
        >
          {isLoading ? "Encolando..." : "Cargar en BUK por contingencia"}
        </button>
      </div>
      {message ? <p className="control-inline-error">{message}</p> : null}
    </div>
  );
}
