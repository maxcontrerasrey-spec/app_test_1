import { DatePickerField } from "../../../shared/ui";
import { parseDateValue } from "../../../shared/lib/date";
import { OperationsDriverLookup } from "./OperationsDriverLookup";
import type { ServiceDataRecord } from "../data/services-data";
import type { Driver, Equipment, ServiceDraft } from "../types";

interface OperationsBaseRegisterProps {
  selectedDateValue: string;
  setSelectedDateValue: (value: string) => void;
  selectedShift: string;
  setSelectedShift: (value: string) => void;
  selectedContract: string;
  setSelectedContract: (value: string) => void;
  contractOptions: string[];
  eligibleServices: ServiceDataRecord[];
  categoriesCount: number;
  submitState: {
    loading: boolean;
    error: string;
    success: string;
    fieldErrors: Record<string, string>;
    fieldErrorsByService: Record<number, Record<string, string>>;
  };
  allServicesComplete: boolean;
  handlePlanSubmit: () => Promise<void>;
  getDraft: (serviceId: number) => ServiceDraft;
  updateDraft: (serviceId: number, patch: Partial<ServiceDraft>) => void;
  getDriverById: (driverId: string) => Driver | null;
  rememberDriver: (driver: Driver) => void;
  getEquipmentByCode: (code: string) => Equipment | null;
  expandedServiceId: number | null;
  setExpandedServiceId: (value: number | null) => void;
  openEquipmentServiceId: number | null;
  setOpenEquipmentServiceId: (value: number | null) => void;
  equipmentQuery: string;
  setEquipmentQuery: (value: string) => void;
  filteredEquipment: Equipment[];
}

function formatLongDate(date: Date | null): string {
  if (!date) return "sin fecha";
  return date.toLocaleDateString("es-CL", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getDriverRosterLabel(driver: Driver | null) {
  if (!driver) return "";

  switch (driver.rosterEffectiveStatus) {
    case "vacation":
      return "Vacaciones";
    case "medical_leave":
      return "Licencia médica";
    case "extra_shift":
      return "Turno adicional";
    default:
      if (driver.isRestDay) return "Descanso";
      if (driver.isWorkingDay) return "Turno";
      return "Sin pauta";
  }
}

function getDriverRosterTone(driver: Driver | null) {
  if (!driver) return "is-empty";
  if (driver.isRestDay) return "is-resting";
  if (driver.isWorkingDay || driver.rosterEffectiveStatus === "extra_shift") return "is-working";
  return "is-neutral";
}

export function OperationsBaseRegister({
  selectedDateValue,
  setSelectedDateValue,
  selectedShift,
  setSelectedShift,
  selectedContract,
  setSelectedContract,
  contractOptions,
  eligibleServices,
  categoriesCount,
  submitState,
  allServicesComplete,
  handlePlanSubmit,
  getDraft,
  updateDraft,
  getDriverById,
  rememberDriver,
  getEquipmentByCode,
  expandedServiceId,
  setExpandedServiceId,
  openEquipmentServiceId,
  setOpenEquipmentServiceId,
  equipmentQuery,
  setEquipmentQuery,
  filteredEquipment,
}: OperationsBaseRegisterProps) {
  const selectedDate = selectedDateValue ? parseDateValue(selectedDateValue) : null;
  const shiftLabel = selectedShift ? selectedShift.toUpperCase() : "Sin turno";

  return (
    <section className="operations-page-shell">
      <section className="operations-control-grid operations-control-grid--base">
        <section className="panel operations-panel jornada-panel">
          <p className="panel-label">Jornada</p>
          <div className="field-grid">
            <DatePickerField id="selected-date-value" label="Fecha" value={selectedDateValue} onChange={setSelectedDateValue} />
            <label>
              <span>Turno</span>
              <select value={selectedShift} onChange={(event) => setSelectedShift(event.target.value)} aria-invalid={Boolean(submitState.fieldErrors.shift)}>
                <option value="">Selecciona turno</option>
                <option value="am">AM</option>
                <option value="pm">PM</option>
              </select>
            </label>
          </div>
          {submitState.fieldErrors.serviceDate || submitState.fieldErrors.shift ? (
            <div className="panel-inline-errors">
              <p className="field-error">{submitState.fieldErrors.serviceDate || ""}</p>
              <p className="field-error">{submitState.fieldErrors.shift || ""}</p>
            </div>
          ) : null}
        </section>

        <section className="panel operations-panel operations-panel--entry">
          <p className="panel-label">Ingreso</p>
          <label>
            <span>Contrato</span>
            <select value={selectedContract} onChange={(event) => setSelectedContract(event.target.value)} aria-invalid={Boolean(submitState.fieldErrors.contractCode)}>
              <option value="">Selecciona contrato</option>
              {contractOptions.map((contract) => (
                <option key={contract} value={contract}>
                  {contract}
                </option>
              ))}
            </select>
          </label>
          {submitState.fieldErrors.contractCode ? <p className="field-error">{submitState.fieldErrors.contractCode}</p> : null}
        </section>

        <section className="panel operations-panel metrics operations-metrics-panel">
          <article>
            <span>Servicios del día</span>
            <strong>{eligibleServices.length}</strong>
          </article>
          <article>
            <span>Contrato activo</span>
            <strong>{selectedContract || "Todos"}</strong>
          </article>
          <article>
            <span>Categorías</span>
            <strong>{categoriesCount}</strong>
          </article>
        </section>
      </section>

      <section className="toolbar">
        <div className="toolbar-copy">
          <h3>Planificacion de Servicios - {selectedContract || "Sin contrato"} - {shiftLabel}</h3>
          <p>Para {formatLongDate(selectedDate)}.</p>
        </div>
        <div className="toolbar-actions">
          <button
            type="button"
            className={`primary-button submit-plan-button${allServicesComplete ? " is-ready" : ""}`}
            onClick={handlePlanSubmit}
            disabled={submitState.loading || !allServicesComplete}
          >
            {submitState.loading ? "Enviando..." : "Enviar Planificacion"}
          </button>
        </div>
      </section>

      <section className="operation-workspace">
        {eligibleServices.length === 0 ? (
          <article className="service-module service-module--empty">
            <p className="helper-copy">Selecciona contrato, fecha y turno para habilitar servicios operacionales.</p>
          </article>
        ) : (
          eligibleServices.map((service) => {
            const draft = getDraft(service.id);
            const selectedDriver = getDriverById(draft.driverId);
            const selectedEquipment = getEquipmentByCode(draft.equipmentCode);
            const isExpanded = expandedServiceId === service.id;
            const isComplete = Boolean(selectedDriver && selectedEquipment);
            const fieldErrors = submitState.fieldErrorsByService[service.id] || {};

            return (
              <article
                key={service.id}
                className={`service-module${isExpanded ? " is-expanded" : " is-collapsed"}${isComplete ? " is-complete" : ""}`}
              >
                <div className="service-module__header">
                  <button
                    type="button"
                    className="service-module__toggle"
                    aria-expanded={isExpanded}
                    onClick={() => {
                      setExpandedServiceId(expandedServiceId === service.id ? null : service.id);
                      setOpenEquipmentServiceId(null);
                      setEquipmentQuery("");
                    }}
                  >
                    <span className="service-module__toggle-mark">−</span>
                  </button>

                  {!isExpanded ? (
                    <div className="service-module__summary">
                      <strong className={`service-module__service-pill${isComplete ? " is-complete" : " is-pending"}`}>{service.service}</strong>
                      <span>{selectedDriver?.fullName || "Sin conductor"}</span>
                      <span>{selectedEquipment?.code || "Sin equipo"}</span>
                    </div>
                  ) : (
                    <div className="service-module__summary service-module__summary--expanded" />
                  )}

                  <div className="service-module__header-side">
                    {isComplete ? <span className="service-module__complete-dot" aria-label="Servicio completo" /> : null}
                    <span className="badge badge-soft">{service.schedule ?? "Sin periodicidad"}</span>
                  </div>
                </div>

                {isExpanded ? (
                  <div className="service-module__body">
                    <div className="service-assignment-row">
                      <label className="service-assignment-field">
                        <span>Servicio</span>
                        <input type="text" readOnly value={service.service} className="compact-readonly" />
                      </label>

                      <label className="service-assignment-field">
                        <span>Nombre contractual</span>
                        <input type="text" readOnly value={service.contractName ?? ""} className="compact-readonly" />
                      </label>

                      <label className="service-assignment-field">
                        <span>Categoría contractual</span>
                        <input type="text" readOnly value={service.category ?? ""} className="compact-readonly" />
                      </label>

                      <label className="service-assignment-field">
                        <span>Empresa usuaria</span>
                        <input type="text" readOnly value={service.company ?? ""} className="compact-readonly" />
                      </label>
                    </div>

                    <div className="service-reference-row service-reference-row--driver">
                      <OperationsDriverLookup
                        id={`operations-driver-${service.id}`}
                        label="Conductor"
                        placeholder="Busca conductor por nombre o RUT"
                        selectedWorker={selectedDriver}
                        serviceDate={selectedDateValue}
                        onSelect={(driver) => {
                          if (driver) {
                            rememberDriver(driver);
                            updateDraft(service.id, { driverId: driver.id });
                            return;
                          }

                          updateDraft(service.id, { driverId: "" });
                        }}
                      />

                      <label className="service-assignment-field">
                        <span>RUT / Documento</span>
                        <input type="text" readOnly value={selectedDriver?.documentNumber ?? ""} className="compact-readonly" />
                      </label>

                      <label className="service-assignment-field">
                        <span>Área</span>
                        <input type="text" readOnly value={selectedDriver?.areaName || selectedDriver?.areaCode || ""} className="compact-readonly" />
                      </label>

                      <label className="service-assignment-field">
                        <span>Estado de turno</span>
                        <div className={`shift-status-indicator ${getDriverRosterTone(selectedDriver)}`}>
                          <span className="shift-status-indicator__dot" aria-hidden="true" />
                          <span className="shift-status-indicator__label">
                            {getDriverRosterLabel(selectedDriver) || "Sin pauta"}
                          </span>
                        </div>
                      </label>
                    </div>

                    <div className="service-reference-row service-reference-row--equipment">
                      <label className="service-assignment-field">
                        <span>Equipo</span>
                        <div className="driver-picker">
                          <button
                            type="button"
                            className="driver-picker__trigger"
                            aria-expanded={selectedEquipment ? false : openEquipmentServiceId === service.id}
                            aria-invalid={Boolean(fieldErrors.equipmentCode)}
                            onClick={() => {
                              if (selectedEquipment) return;
                              setOpenEquipmentServiceId(openEquipmentServiceId === service.id ? null : service.id);
                            }}
                          >
                            <span className="driver-picker__value">{selectedEquipment?.code || "Selecciona equipo"}</span>
                            {selectedEquipment ? (
                              <span
                                className="driver-picker__clear"
                                role="button"
                                tabIndex={0}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  updateDraft(service.id, { equipmentCode: "" });
                                  setEquipmentQuery("");
                                  setOpenEquipmentServiceId(null);
                                }}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    updateDraft(service.id, { equipmentCode: "" });
                                    setEquipmentQuery("");
                                    setOpenEquipmentServiceId(null);
                                  }
                                }}
                                aria-label="Quitar equipo seleccionado"
                              >
                                ×
                              </span>
                            ) : null}
                            {!selectedEquipment ? <span className="driver-picker__chevron" /> : null}
                          </button>

                          {openEquipmentServiceId === service.id ? (
                            <div className="driver-picker__popover">
                              <input
                                type="text"
                                value={equipmentQuery}
                                onChange={(event) => setEquipmentQuery(event.target.value)}
                                placeholder="Buscar por equipo, patente o tipo"
                                className="driver-picker__search"
                                autoFocus
                              />
                              <div className="driver-picker__list" role="listbox" aria-label="Resultados de equipo">
                                {filteredEquipment.length > 0 ? (
                                  filteredEquipment.map((item) => (
                                    <button
                                      key={item.code}
                                      type="button"
                                      className={`driver-picker__option${item.code === draft.equipmentCode ? " is-selected" : ""}`}
                                      onClick={() => {
                                        updateDraft(service.id, { equipmentCode: item.code });
                                        setOpenEquipmentServiceId(null);
                                        setEquipmentQuery("");
                                      }}
                                    >
                                      {item.code}
                                    </button>
                                  ))
                                ) : (
                                  <p className="driver-picker__empty">No se encontraron equipos.</p>
                                )}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </label>

                      <label className="service-assignment-field">
                        <span>Tipo</span>
                        <input type="text" readOnly value={selectedEquipment?.type ?? ""} className="compact-readonly" />
                      </label>

                      <label className="service-assignment-field">
                        <span>Patente</span>
                        <input type="text" readOnly value={selectedEquipment?.plate ?? ""} className="compact-readonly" />
                      </label>

                      <label className="service-assignment-field">
                        <span>Cliente actual</span>
                        <input type="text" readOnly value={selectedEquipment?.currentClient ?? ""} className="compact-readonly" />
                      </label>
                    </div>

                    <div className="field-errors-grid field-errors-grid--service field-errors-grid--compact">
                      <span />
                      <span />
                      <span />
                      <span />
                    </div>
                    <div className="field-errors-grid field-errors-grid--service field-errors-grid--compact">
                      {fieldErrors.driverName ? <p className="field-error">{fieldErrors.driverName}</p> : <span />}
                      <span />
                      <span />
                      <span />
                    </div>
                    <div className="field-errors-grid field-errors-grid--service field-errors-grid--compact">
                      {fieldErrors.equipmentCode ? <p className="field-error">{fieldErrors.equipmentCode}</p> : <span />}
                      <span />
                      <span />
                      <span />
                    </div>
                    {openEquipmentServiceId === service.id && equipmentQuery ? <p className="helper-copy helper-copy--tight">{filteredEquipment.length} equipo(s) encontrados.</p> : null}
                  </div>
                ) : null}
              </article>
            );
          })
        )}
        {submitState.error ? <p className="submit-feedback submit-feedback--error">{submitState.error}</p> : null}
        {submitState.success ? <p className="submit-feedback submit-feedback--success">{submitState.success}</p> : null}
      </section>
    </section>
  );
}
