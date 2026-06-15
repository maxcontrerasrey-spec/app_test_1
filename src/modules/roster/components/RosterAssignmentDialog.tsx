import { useEffect, useMemo, useState } from "react";
import { DatePickerField, SelectField, TextField } from "../../../shared/ui";
import { formatRequestDate } from "../../../shared/lib/format";
import { toTodayDateValue } from "../../../shared/lib/date";
import type { RosterWorkerSearchItem, ShiftPattern, WorkerRosterAssignment } from "../types";

type RosterAssignmentDialogProps = {
  isOpen: boolean;
  worker: RosterWorkerSearchItem | null;
  patterns: ShiftPattern[];
  assignments?: WorkerRosterAssignment[];
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
  assignments = [],
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
  const startDateValue = startDate || null;
  const endDateValue = endDate || null;
  const overlappingAssignments = useMemo(() => {
    if (!startDateValue) {
      return [];
    }

    const normalizedEndDate = endDateValue || "9999-12-31";

    return assignments.filter((assignment) => {
      const assignmentEndDate = assignment.endDate || "9999-12-31";
      return assignment.startDate <= normalizedEndDate && assignmentEndDate >= startDateValue;
    });
  }, [assignments, endDateValue, startDateValue]);
  const currentAssignmentAtStart = useMemo(() => {
    if (!startDateValue) {
      return null;
    }

    return (
      assignments.find((assignment) => {
        const assignmentEndDate = assignment.endDate || "9999-12-31";
        return assignment.startDate < startDateValue && assignmentEndDate >= startDateValue;
      }) ?? null
    );
  }, [assignments, startDateValue]);
  const blockingOverlapAssignments = useMemo(() => {
    if (!startDateValue) {
      return [];
    }

    return overlappingAssignments.filter((assignment) => assignment.startDate >= startDateValue);
  }, [overlappingAssignments, startDateValue]);
  const willCreateGapAfterTemporaryCycle = useMemo(() => {
    if (!currentAssignmentAtStart || !startDateValue || !endDateValue) {
      return false;
    }

    const currentAssignmentEndDate = currentAssignmentAtStart.endDate || "9999-12-31";
    return currentAssignmentEndDate > endDateValue;
  }, [currentAssignmentAtStart, endDateValue, startDateValue]);

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

        <div className="roster-form-grid">
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

        {currentAssignmentAtStart ? (
          <article className="roster-assignment-warning-card roster-assignment-warning-card--warning">
            <strong>La pauta actual se ajustará</strong>
            <p>
              Existe una pauta vigente <strong>{currentAssignmentAtStart.patternName}</strong> desde{" "}
              {formatRequestDate(currentAssignmentAtStart.startDate)}
              {currentAssignmentAtStart.endDate
                ? ` hasta ${formatRequestDate(currentAssignmentAtStart.endDate)}`
                : " sin término definido"}
              . Si guardas esta nueva asignación desde el{" "}
              {formatRequestDate(startDateValue ?? toTodayDateValue())}, la pauta actual se cerrará
              el día anterior.
            </p>
            {willCreateGapAfterTemporaryCycle ? (
              <p>
                Como además definiste término para el nuevo ciclo, al finalizar ese rango el
                trabajador quedará sin pauta hasta que cargues otra asignación.
              </p>
            ) : null}
          </article>
        ) : null}

        {blockingOverlapAssignments.length > 0 ? (
          <article className="roster-assignment-warning-card roster-assignment-warning-card--danger">
            <strong>El rango se superpone y será bloqueado</strong>
            <p>
              Ya existe al menos una asignación con inicio dentro del rango que intentas guardar.
              El backend no permitirá esta nueva pauta mientras no ajustes o elimines la
              superposición.
            </p>
            <ul className="roster-assignment-warning-list">
              {blockingOverlapAssignments.map((assignment) => (
                <li key={assignment.id}>
                  {assignment.patternName} · {formatRequestDate(assignment.startDate)}
                  {assignment.endDate ? ` al ${formatRequestDate(assignment.endDate)}` : " en adelante"}
                </li>
              ))}
            </ul>
          </article>
        ) : null}

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
