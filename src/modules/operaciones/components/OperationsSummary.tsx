import { Fragment, useState } from "react";
import { DatePickerField, SelectField } from "../../../shared/ui";
import type { DashboardSummary } from "../types";

interface OperationsSummaryProps {
  dashboardContract: string;
  setDashboardContract: (value: string) => void;
  contractOptions: string[];
  dashboardDateFrom: string;
  setDashboardDateFrom: (value: string) => void;
  dashboardDateTo: string;
  setDashboardDateTo: (value: string) => void;
  dashboardSummary: DashboardSummary;
  dashboardLoading: boolean;
  dashboardError: string;
}

function formatShiftLabel(value: string | null) {
  return value?.trim() || "Sin turno";
}

function formatDriverShiftStatus(value: string | null, serviceExecutionStatus: string | null) {
  if (serviceExecutionStatus === "not_performed") {
    return "Servicio no realizado";
  }

  if (value === "en_turno") {
    return "En turno";
  }

  if (value === "fuera_de_turno") {
    return "Fuera de turno";
  }

  return "Sin pauta";
}

function buildEquipmentLabel({
  equipmentCode,
  equipmentPlate,
  equipmentType
}: {
  equipmentCode: string | null;
  equipmentPlate: string | null;
  equipmentType: string | null;
}) {
  const parts = [equipmentCode, equipmentPlate, equipmentType].map((item) => item?.trim()).filter(Boolean);
  return parts.length > 0 ? parts.join(" / ") : "Sin equipo";
}

export function OperationsSummary({
  dashboardContract,
  setDashboardContract,
  contractOptions,
  dashboardDateFrom,
  setDashboardDateFrom,
  dashboardDateTo,
  setDashboardDateTo,
  dashboardSummary,
  dashboardLoading,
  dashboardError
}: OperationsSummaryProps) {
  const [expandedContracts, setExpandedContracts] = useState<Set<string>>(new Set());
  const dashboardCompletionRate =
    dashboardSummary.totalExpected > 0 ? Math.round((dashboardSummary.totalPlanned / dashboardSummary.totalExpected) * 100) : 0;

  const toggleContract = (contractCode: string) => {
    setExpandedContracts((current) => {
      const next = new Set(current);
      if (next.has(contractCode)) {
        next.delete(contractCode);
      } else {
        next.add(contractCode);
      }
      return next;
    });
  };

  return (
    <section className="operations-page-shell">
      <section className="operations-control-grid operations-control-grid--summary">
        <section className="panel operations-panel">
          <p className="panel-label">Resumen</p>
          <SelectField
            id="operations-summary-contract"
            label="Contrato"
            value={dashboardContract}
            onChange={(event) => setDashboardContract(event.target.value)}
            placeholder="Todos los contratos"
            options={contractOptions.map((contract) => ({
              value: contract,
              label: contract
            }))}
          />
          <div className="operations-inline-fields">
            <DatePickerField id="dashboard-date-from" label="Desde" value={dashboardDateFrom} onChange={setDashboardDateFrom} />
            <DatePickerField id="dashboard-date-to" label="Hasta" value={dashboardDateTo} onChange={setDashboardDateTo} />
          </div>
        </section>

        <section className="panel operations-panel metrics operations-metrics-panel">
          <article>
            <span>Planificados</span>
            <strong>{dashboardSummary.totalPlanned}</strong>
          </article>
          <article>
            <span>Base habilitada</span>
            <strong>{dashboardSummary.totalExpected}</strong>
          </article>
          <article>
            <span>Cobertura</span>
            <strong>{dashboardCompletionRate}%</strong>
          </article>
        </section>
      </section>

      <section className="dashboard-shell">
        <section className="dashboard-table-card">
          {dashboardError ? <p className="submit-feedback submit-feedback--error">{dashboardError}</p> : null}

          <div className="dashboard-table">
            <div className="dashboard-table__head">
              <span>Contrato</span>
              <span>Planificados</span>
              <span>Base habilitada</span>
              <span>En turno</span>
              <span>Fuera de turno</span>
              <span>Cobertura</span>
            </div>

            {dashboardLoading ? (
              <div className="dashboard-table__row dashboard-table__row--empty">
                <span>Cargando indicadores...</span>
              </div>
            ) : dashboardSummary.byContract.length > 0 ? (
              dashboardSummary.byContract.map((item) => {
                const isExpanded = expandedContracts.has(item.contractCode);

                return (
                  <Fragment key={item.contractCode}>
                    <button
                      className="dashboard-table__row dashboard-table__row--button"
                      type="button"
                      onClick={() => toggleContract(item.contractCode)}
                      aria-expanded={isExpanded}
                      aria-controls={`operations-summary-detail-${item.contractCode}`}
                    >
                      <strong>
                        <span className="dashboard-table__chevron" aria-hidden="true">
                          {isExpanded ? "-" : "+"}
                        </span>
                        {item.contractCode}
                      </strong>
                      <span>{item.plannedServices}</span>
                      <span>{item.expectedServices}</span>
                      <span>{item.inTurnWorkers}</span>
                      <span>{item.outOfTurnWorkers}</span>
                      <span>{item.completionRate}%</span>
                    </button>

                    {isExpanded ? (
                      <div className="dashboard-table__detail" id={`operations-summary-detail-${item.contractCode}`}>
                        {item.serviceDetails.length > 0 ? (
                          <div className="dashboard-detail-table">
                            <div className="dashboard-detail-table__head">
                              <span>Servicio</span>
                              <span>Conductor</span>
                              <span>Equipo</span>
                              <span>Turno</span>
                            </div>
                            {item.serviceDetails.map((detail) => (
                              <div className="dashboard-detail-table__row" key={detail.key}>
                                <div>
                                  <strong>{detail.serviceName}</strong>
                                  <small>
                                    {detail.serviceDate} / {formatShiftLabel(detail.shift)}
                                  </small>
                                </div>
                                <span>{detail.driverName?.trim() || "Sin conductor"}</span>
                                <span>
                                  {buildEquipmentLabel({
                                    equipmentCode: detail.equipmentCode,
                                    equipmentPlate: detail.equipmentPlate,
                                    equipmentType: detail.equipmentType
                                  })}
                                </span>
                                <span>{formatDriverShiftStatus(detail.driverShiftStatus, detail.serviceExecutionStatus)}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="dashboard-table__detail-empty">Sin servicios planificados en el rango seleccionado.</p>
                        )}
                      </div>
                    ) : null}
                  </Fragment>
                );
              })
            ) : (
              <div className="dashboard-table__row dashboard-table__row--empty">
                <span>No hay datos para el rango seleccionado.</span>
              </div>
            )}
          </div>
        </section>
      </section>
    </section>
  );
}
