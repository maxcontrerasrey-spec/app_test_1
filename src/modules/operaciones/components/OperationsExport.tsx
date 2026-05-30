import { DatePickerField } from "../../../shared/ui";
import type { ExportEntryRow } from "../types";

interface OperationsExportProps {
  exportContract: string;
  setExportContract: (value: string) => void;
  contractOptions: string[];
  exportDateFrom: string;
  setExportDateFrom: (value: string) => void;
  exportDateTo: string;
  setExportDateTo: (value: string) => void;
  exportRows: ExportEntryRow[];
  exportLoading: boolean;
  exportError: string;
  exportSearched: boolean;
  handleExportSearch: () => Promise<void>;
  handleExportExcel: () => Promise<void>;
}

function formatShiftLabel(shift: string | null | undefined): string {
  return shift ? shift.toUpperCase() : "";
}

function formatTurnStatusLabel(value: string | null | undefined): string {
  return value === "fuera_de_turno" ? "Fuera de Turno" : "En Turno";
}

export function OperationsExport({
  exportContract,
  setExportContract,
  contractOptions,
  exportDateFrom,
  setExportDateFrom,
  exportDateTo,
  setExportDateTo,
  exportRows,
  exportLoading,
  exportError,
  exportSearched,
  handleExportSearch,
  handleExportExcel
}: OperationsExportProps) {
  const exportHasRows = exportRows.length > 0;

  return (
    <section className="operations-page-shell">
      <section className="dashboard-hero operations-page-hero">
        <div className="dashboard-hero__copy">
          <h3>Exportador de Información</h3>
          <p>Consulta información histórica por contrato y rango de fechas, revisa una vista previa y exporta el resultado a Excel.</p>
        </div>
      </section>

      <section className="operations-control-grid operations-control-grid--export">
        <section className="panel operations-panel">
          <p className="panel-label">Exportador</p>
          <label>
            <span>Contrato</span>
            <select value={exportContract} onChange={(event) => setExportContract(event.target.value)}>
              <option value="">Todos los contratos</option>
              {contractOptions.map((contract) => (
                <option key={contract} value={contract}>
                  {contract}
                </option>
              ))}
            </select>
          </label>
          <div className="operations-inline-fields">
            <DatePickerField id="export-date-from" label="Desde" value={exportDateFrom} onChange={setExportDateFrom} />
            <DatePickerField id="export-date-to" label="Hasta" value={exportDateTo} onChange={setExportDateTo} />
          </div>
          <div className="export-sidebar-actions">
            <button type="button" className="ghost-button ghost-button--full" onClick={handleExportSearch} disabled={exportLoading}>
              {exportLoading ? "Buscando..." : "Buscar"}
            </button>
            <button type="button" className="primary-button export-button" onClick={handleExportExcel} disabled={!exportHasRows || exportLoading}>
              Exportar Excel
            </button>
          </div>
          {exportError ? <p className="field-error">{exportError}</p> : null}
        </section>

        <section className="panel operations-panel metrics operations-metrics-panel">
          <article>
            <span>Filas encontradas</span>
            <strong>{exportRows.length}</strong>
          </article>
          <article>
            <span>Contrato</span>
            <strong>{exportContract || "Todos"}</strong>
          </article>
          <article>
            <span>Rango</span>
            <strong>{exportDateFrom && exportDateTo ? `${exportDateFrom} a ${exportDateTo}` : "Sin rango"}</strong>
          </article>
        </section>
      </section>

      <article className="dashboard-table-card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Vista previa</p>
            <h3>Planificaciones históricas</h3>
          </div>
        </div>

        {exportError ? <p className="submit-feedback submit-feedback--error">{exportError}</p> : null}

        {exportLoading ? (
          <div className="export-empty-state">
            <span>Cargando vista previa...</span>
          </div>
        ) : exportHasRows ? (
          <div className="dashboard-table dashboard-table--export">
            <div className="dashboard-table__head dashboard-table__head--export">
              <span>Fecha</span>
              <span>Turno</span>
              <span>Contrato</span>
              <span>Servicio</span>
              <span>Conductor</span>
              <span>Estado</span>
              <span>Equipo</span>
              <span>Patente</span>
            </div>

            {exportRows.map((row, index) => (
              <div key={`${row.service_date}-${row.contract_code}-${row.service_operational_name}-${row.equipment_code}-${index}`} className="dashboard-table__row dashboard-table__row--export">
                <span>{row.service_date}</span>
                <span>{formatShiftLabel(row.shift)}</span>
                <strong>{row.contract_code || ""}</strong>
                <span>{row.service_operational_name || ""}</span>
                <span>{row.driver_name || ""}</span>
                <span>{formatTurnStatusLabel(row.driver_shift_status)}</span>
                <span>{row.equipment_code || ""}</span>
                <span>{row.equipment_plate || ""}</span>
              </div>
            ))}
          </div>
        ) : exportSearched ? (
          <div className="export-empty-state">
            <span>No hay registros para el criterio seleccionado.</span>
          </div>
        ) : (
          <div className="export-empty-state">
            <span>Define contrato y rango de fechas, luego presiona Buscar para cargar la vista previa.</span>
          </div>
        )}
      </article>
    </section>
  );
}
