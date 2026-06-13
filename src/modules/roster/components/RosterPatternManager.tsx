import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { SelectField, TextField } from "../../../shared/ui";
import { queryKeys } from "../../../shared/lib/queryKeys";
import { setShiftPatternStatus, upsertShiftPattern } from "../services/rosterApi";
import type { RosterSetupCatalogs } from "../types";

type RosterPatternManagerProps = {
  setupCatalogs: RosterSetupCatalogs;
};

const COLOR_OPTIONS = [
  { value: "#2563eb", label: "Azul operacional" },
  { value: "#0f766e", label: "Verde control" },
  { value: "#d97706", label: "Ámbar" },
  { value: "#7c3aed", label: "Violeta" },
  { value: "#dc2626", label: "Rojo" }
];

export function RosterPatternManager({ setupCatalogs }: RosterPatternManagerProps) {
  const queryClient = useQueryClient();
  const [codeDraft, setCodeDraft] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [workingDaysDraft, setWorkingDaysDraft] = useState("7");
  const [restingDaysDraft, setRestingDaysDraft] = useState("7");
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [colorHexDraft, setColorHexDraft] = useState("#2563eb");
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const patterns = useMemo(
    () => [...setupCatalogs.patterns].sort((left, right) => Number(right.isActive) - Number(left.isActive) || left.name.localeCompare(right.name)),
    [setupCatalogs.patterns]
  );

  const refreshCatalogs = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.roster.setupCatalogs() });

  const savePatternMutation = useMutation({
    mutationFn: upsertShiftPattern,
    onSuccess: async () => {
      setCodeDraft("");
      setNameDraft("");
      setWorkingDaysDraft("7");
      setRestingDaysDraft("7");
      setDescriptionDraft("");
      setColorHexDraft("#2563eb");
      setErrorMessage("");
      setStatusMessage("Pauta actualizada correctamente.");
      await refreshCatalogs();
    },
    onError: (error: Error) => {
      setStatusMessage("");
      setErrorMessage(error.message);
    }
  });

  const togglePatternMutation = useMutation({
    mutationFn: ({ patternId, isActive }: { patternId: string; isActive: boolean }) =>
      setShiftPatternStatus(patternId, isActive),
    onSuccess: refreshCatalogs
  });

  return (
    <section className="roster-pattern-grid">
      <section className="info-card">
        <div className="tracking-toolbar-copy">
          <h3>Gestor de pautas</h3>
          <span className="tracking-filter-caption">
            Define ciclos reutilizables como 7x7, 4x3, 5x2 o cualquier otra combinación operativa.
          </span>
        </div>

        <div className="hr-incentives-form-grid hr-incentives-form-grid-compact">
          <TextField
            id="roster-pattern-code"
            label="Código"
            value={codeDraft}
            onChange={(event) => setCodeDraft(event.target.value)}
            placeholder="7x7_mina"
          />
          <TextField
            id="roster-pattern-name"
            label="Nombre"
            value={nameDraft}
            onChange={(event) => setNameDraft(event.target.value)}
            placeholder="7x7 Mina"
          />
          <TextField
            id="roster-pattern-working-days"
            label="Días trabajo"
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={workingDaysDraft}
            onChange={(event) => setWorkingDaysDraft(event.target.value)}
          />
          <TextField
            id="roster-pattern-resting-days"
            label="Días descanso"
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            value={restingDaysDraft}
            onChange={(event) => setRestingDaysDraft(event.target.value)}
          />
          <SelectField
            id="roster-pattern-color"
            label="Color"
            value={colorHexDraft}
            onChange={(event) => setColorHexDraft(event.target.value)}
            options={COLOR_OPTIONS}
          />
          <TextField
            id="roster-pattern-description"
            label="Descripción"
            value={descriptionDraft}
            onChange={(event) => setDescriptionDraft(event.target.value)}
            placeholder="Uso operacional de la pauta"
          />
        </div>

        {statusMessage ? <p className="form-status form-status-success">{statusMessage}</p> : null}
        {errorMessage ? <p className="form-status form-status-error">{errorMessage}</p> : null}

        <div className="action-row">
          <button
            type="button"
            className="soft-primary-button soft-primary-button-success"
            disabled={
              savePatternMutation.isPending ||
              !nameDraft.trim() ||
              Number(workingDaysDraft) <= 0 ||
              Number(restingDaysDraft) < 0
            }
            onClick={() =>
              savePatternMutation.mutate({
                code: codeDraft.trim() || null,
                name: nameDraft.trim(),
                workingDays: Number(workingDaysDraft),
                restingDays: Number(restingDaysDraft),
                description: descriptionDraft.trim() || null,
                colorHex: colorHexDraft
              })
            }
          >
            {savePatternMutation.isPending ? "Guardando..." : "Guardar pauta"}
          </button>
        </div>
      </section>

      <section className="info-card">
        <div className="tracking-toolbar-copy">
          <h3>Pautas registradas</h3>
        </div>

        <div className="hr-incentives-list">
          {patterns.map((pattern) => (
            <div key={pattern.id} className="hr-incentives-list-item roster-pattern-list-item">
              <div>
                <strong>
                  <span
                    className="roster-pattern-swatch"
                    style={{ backgroundColor: pattern.colorHex ?? "#2563eb" }}
                  />
                  {pattern.name}
                </strong>
                <span>
                  {pattern.workingDays}x{pattern.restingDays} · ciclo {pattern.cycleLength} días ·{" "}
                  {pattern.isActive ? "Activa" : "Inactiva"}
                </span>
                {pattern.description ? <small>{pattern.description}</small> : null}
              </div>
              <button
                type="button"
                className="soft-primary-button hr-incentives-inline-button"
                disabled={togglePatternMutation.isPending}
                onClick={() =>
                  togglePatternMutation.mutate({
                    patternId: pattern.id,
                    isActive: !pattern.isActive
                  })
                }
              >
                {pattern.isActive ? "Desactivar" : "Activar"}
              </button>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}
