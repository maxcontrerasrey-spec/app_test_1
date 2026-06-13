import { useEffect, useMemo, useState } from "react";
import { DatePickerField, SelectField, TextField } from "../../../shared/ui";
import { toTodayDateValue } from "../../../shared/lib/date";
import type { RosterWorkerSearchItem, ShiftPattern } from "../types";

type RosterAssignmentDialogProps = {
  isOpen: boolean;
  worker: RosterWorkerSearchItem | null;
  patterns: ShiftPattern[];
  isSubmitting?: boolean;
  onClose: () => void;
  onConfirm: (payload: {
    patternId: string;
    startDate: string;
    endDate: string;
    notes: string;
  }) => Promise<void> | void;
};

export function RosterAssignmentDialog({
  isOpen,
  worker,
  patterns,
  isSubmitting = false,
  onClose,
  onConfirm
}: RosterAssignmentDialogProps) {
  const [patternId, setPatternId] = useState("");
  const [startDate, setStartDate] = useState(toTodayDateValue());
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const patternOptions = useMemo(
    () =>
      patterns
        .filter((pattern) => pattern.isActive)
        .map((pattern) => ({
          value: pattern.id,
          label: `${pattern.name} · ${pattern.workingDays}x${pattern.restingDays}`
        })),
    [patterns]
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setPatternId(patternOptions[0]?.value ?? "");
    setStartDate(toTodayDateValue());
    setEndDate("");
    setNotes("");
    setErrorMessage("");
  }, [isOpen, patternOptions]);

  if (!isOpen || !worker) {
    return null;
  }

  const handleConfirm = async () => {
    if (!patternId) {
      setErrorMessage("Debes seleccionar una pauta.");
      return;
    }

    if (!startDate) {
      setErrorMessage("Debes indicar el día 1 de trabajo.");
      return;
    }

    if (endDate && endDate < startDate) {
      setErrorMessage("La fecha de término no puede ser menor a la fecha de inicio.");
      return;
    }

    setErrorMessage("");
    await onConfirm({ patternId, startDate, endDate, notes });
  };

  return (
    <div className="approval-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="approval-modal-card roster-assignment-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="roster-assignment-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="home-section-header">
          <div>
            <h3 id="roster-assignment-dialog-title">Asignar pauta</h3>
            <p>
              Define la pauta activa para {worker.fullName}. El día de inicio marcará el día 1 del
              bloque de trabajo.
            </p>
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

        <div className="hr-incentives-form-grid hr-incentives-form-grid-compact">
          <SelectField
            id="roster-assignment-pattern"
            label="Pauta"
            value={patternId}
            onChange={(event) => setPatternId(event.target.value)}
            options={patternOptions}
            placeholder="Selecciona una pauta"
          />
          <DatePickerField
            id="roster-assignment-start"
            label="Día 1"
            value={startDate}
            onChange={setStartDate}
            minValue="2025-01-01"
            maxValue=""
          />
          <DatePickerField
            id="roster-assignment-end"
            label="Término (opcional)"
            value={endDate}
            onChange={setEndDate}
            minValue={startDate || "2025-01-01"}
            maxValue=""
          />
          <TextField
            id="roster-assignment-notes"
            label="Notas"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Observaciones de la asignación"
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
            {isSubmitting ? "Guardando..." : "Guardar asignación"}
          </button>
        </div>
      </div>
    </div>
  );
}
