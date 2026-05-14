import { useEffect, useId, useState } from "react";
import {
  instructors,
  vehicleCatalog,
  workers
} from "../../../shared/services/catalogs";
import statusAlertIcon from "../../../assets/status-alert.png";
import statusPendingProcessIcon from "../../../assets/status-pending.png";
import statusErrorIcon from "../../../assets/status-error.png";
import statusSuccessIcon from "../../../assets/status-success.png";

const workerOptions = workers.map((worker) => ({
  ...worker,
  label: `${worker.fullName} · ${worker.rut}`
}));

const brandOptions = Array.from(new Set(vehicleCatalog.map((item) => item.brand))).sort();

type GeneratedCertificateRequest = {
  correlativo: number;
  folio: string;
  estadoCertificado: string;
  instructor: string;
  rutInstructor: string;
  codigoPerfilCv: string;
  firmaInstructor: string;
  fechaCertificacion: string;
  horaCertificacion: string;
  trabajador: string;
  rutTrabajador: string;
  marca: string;
  tipo: string;
  modelo1: string;
  modelo2: string;
  modelo3: string;
  modelosTodos: string;
  evaluacion: string;
};

const statusMeta = {
  Pendiente: {
    icon: statusAlertIcon,
    label: "Pendiente"
  },
  "En proceso": {
    icon: statusPendingProcessIcon,
    label: "En proceso"
  },
  Generado: {
    icon: statusSuccessIcon,
    label: "Generado"
  },
  Error: {
    icon: statusErrorIcon,
    label: "Error"
  }
} as const;

const authorizationMeta = {
  Pendiente: {
    icon: statusAlertIcon,
    label: "Pendiente"
  },
  "No Autorizado": {
    icon: statusErrorIcon,
    label: "No Autorizado"
  },
  Habilitado: {
    icon: statusSuccessIcon,
    label: "Habilitado"
  }
} as const;

function toTodayDateValue() {
  return formatDateValue(new Date());
}

function toCurrentTimeValue() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(
    2,
    "0"
  )}`;
}

function parseDateValue(dateValue: string) {
  const [year, month, day] = dateValue.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDateForDisplay(dateValue: string) {
  const [year, month, day] = dateValue.split("-");
  if (!year || !month || !day) {
    return dateValue;
  }

  return `${day}/${month}/${year}`;
}

function createMockCorrelative() {
  const stored = window.localStorage.getItem("mock-last-correlative");
  const base = stored ? Number(stored) + 1 : 1000;
  window.localStorage.setItem("mock-last-correlative", String(base));
  return base;
}

function createLocalFolio(dateValue: string, timeValue: string, correlative: number) {
  const [year, month, day] = dateValue.split("-");
  const [hours, minutes] = timeValue.split(":");

  return `${day}${month}${year}${hours}${minutes}${correlative}`;
}

function normalizeEvaluationInput(rawValue: string) {
  const digits = rawValue.replace(/\D/g, "");
  if (!digits) {
    return "";
  }

  const normalizedValue = Math.min(100, Number(digits));

  if (normalizedValue < 1) {
    return "";
  }

  return String(normalizedValue);
}

function formatDateValue(dateObject: Date) {
  return `${dateObject.getFullYear()}-${String(dateObject.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(dateObject.getDate()).padStart(2, "0")}`;
}

const monthOptions = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre"
];

function buildCalendarDays(viewDate: Date) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const leadingDays = (firstDayOfMonth.getDay() + 6) % 7;
  const totalDays = lastDayOfMonth.getDate();
  const calendarDays: Array<{ key: string; value: Date; inMonth: boolean }> = [];

  for (let index = leadingDays; index > 0; index -= 1) {
    const date = new Date(year, month, 1 - index);
    calendarDays.push({
      key: `prev-${formatDateValue(date)}`,
      value: date,
      inMonth: false
    });
  }

  for (let day = 1; day <= totalDays; day += 1) {
    const date = new Date(year, month, day);
    calendarDays.push({
      key: `current-${formatDateValue(date)}`,
      value: date,
      inMonth: true
    });
  }

  while (calendarDays.length % 7 !== 0) {
    const date = new Date(year, month, totalDays + (calendarDays.length % 7) + 1);
    calendarDays.push({
      key: `next-${formatDateValue(date)}`,
      value: date,
      inMonth: false
    });
  }

  return calendarDays;
}

export function CertificatesPage() {
  const workerListId = useId();
  const currentYear = new Date().getFullYear();
  const [selectedInstructorId, setSelectedInstructorId] = useState("");
  const [selectedWorkerLabel, setSelectedWorkerLabel] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [selectedModel1, setSelectedModel1] = useState("");
  const [selectedModel2, setSelectedModel2] = useState("");
  const [selectedModel3, setSelectedModel3] = useState("");
  const [evaluationValue, setEvaluationValue] = useState("");
  const [date, setDate] = useState(toTodayDateValue);
  const [time, setTime] = useState(toCurrentTimeValue);
  const [localStatus, setLocalStatus] = useState("");
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [calendarViewDate, setCalendarViewDate] = useState(() => parseDateValue(toTodayDateValue()));
  const [generatedRequest, setGeneratedRequest] =
    useState<GeneratedCertificateRequest | null>(null);

  const selectedInstructor =
    instructors.find((instructor) => instructor.id === selectedInstructorId) ?? null;
  const selectedWorker =
    workerOptions.find((worker) => worker.label === selectedWorkerLabel) ?? null;

  const availableTypes = Array.from(
    new Set(
      vehicleCatalog
        .filter((item) => item.brand === selectedBrand && item.type)
        .map((item) => item.type)
    )
  ).sort();

  const availableModels = vehicleCatalog
    .filter((item) => item.brand === selectedBrand)
    .filter((item) => (selectedType ? item.type === selectedType : false))
    .map((item) => item.model)
    .filter((model, index, list) => list.indexOf(model) === index)
    .sort();

  useEffect(() => {
    setSelectedType("");
    setSelectedModel1("");
    setSelectedModel2("");
    setSelectedModel3("");
  }, [selectedBrand]);

  useEffect(() => {
    setSelectedModel1("");
    setSelectedModel2("");
    setSelectedModel3("");
  }, [selectedType]);

  const modelsSummary = [selectedModel1, selectedModel2, selectedModel3]
    .filter(Boolean)
    .join(" · ");

  const inferredAuthorization = evaluationValue.trim()
    ? Number(evaluationValue) >= 100
      ? "Habilitado"
      : "No Autorizado"
    : "Pendiente";
  const currentAuthorizationMeta =
    authorizationMeta[inferredAuthorization as keyof typeof authorizationMeta];

  const isSubmitEnabled =
    Boolean(selectedInstructor) &&
    Boolean(date) &&
    Boolean(time) &&
    Boolean(selectedWorker) &&
    Boolean(selectedBrand) &&
    Boolean(selectedType) &&
    Boolean(selectedModel1) &&
    Boolean(evaluationValue);

  const handleSubmit = () => {
    if (!isSubmitEnabled) {
      setLocalStatus("Complete los campos obligatorios antes de generar la solicitud.");
      setGeneratedRequest(null);
      return;
    }

    const correlativo = createMockCorrelative();
    const folio = createLocalFolio(date, time, correlativo);
    const request: GeneratedCertificateRequest = {
      correlativo,
      folio,
      estadoCertificado: "Solicitado",
      instructor: selectedInstructor?.fullName ?? "",
      rutInstructor: selectedInstructor?.rut ?? "",
      codigoPerfilCv: selectedInstructor?.profileCode ?? "",
      firmaInstructor: selectedInstructor?.signature ?? "",
      fechaCertificacion: formatDateForDisplay(date),
      horaCertificacion: time,
      trabajador: selectedWorker?.fullName ?? "",
      rutTrabajador: selectedWorker?.rut ?? "",
      marca: selectedBrand,
      tipo: selectedType,
      modelo1: selectedModel1,
      modelo2: selectedModel2,
      modelo3: selectedModel3,
      modelosTodos: modelsSummary,
      evaluacion: evaluationValue ? `${evaluationValue}%` : ""
    };

    setGeneratedRequest(request);
    setLocalStatus(
      "Solicitud generada en modo local. El siguiente paso será enviar esta misma estructura a SharePoint."
    );
    setSelectedInstructorId("");
    setSelectedWorkerLabel("");
    setSelectedBrand("");
    setSelectedType("");
    setSelectedModel1("");
    setSelectedModel2("");
    setSelectedModel3("");
    setEvaluationValue("");
    setDate(toTodayDateValue());
    setTime(toCurrentTimeValue());
    setIsDatePickerOpen(false);
    setCalendarViewDate(parseDateValue(toTodayDateValue()));
  };

  const selectedCalendarDate = parseDateValue(date);
  const calendarDays = buildCalendarDays(calendarViewDate);
  const yearOptions = Array.from({ length: 9 }, (_, index) => currentYear - 4 + index);

  return (
    <section className="page">
      <section className="form-shell">
        <div className="hero-panel form-copy">
          <span className="eyebrow">Modulo 1</span>
          <h2>Generador de Certificados</h2>
          <p className="hero-copy">
            Complete los campos obligatorios de la solicitud para generar el
            certificado.
          </p>
        </div>

        <div className="form-workspace">
          <div className="form-card">
            <div className="field-group">
              <label className="field-label" htmlFor="instructor">
                Instructor
              </label>
              <select
                className="text-field"
                id="instructor"
                value={selectedInstructorId}
                onChange={(event) => setSelectedInstructorId(event.target.value)}
              >
                <option value="">Seleccione el instructor</option>
                {instructors.map((instructor) => (
                  <option key={instructor.id} value={instructor.id}>
                    {instructor.fullName}
                  </option>
                ))}
              </select>
            </div>

            <div className="field-row">
              <div className="field-group">
                <label className="field-label" htmlFor="rut-instructor">
                  Rut instructor
                </label>
                <input
                  className="text-field text-field-readonly"
                  id="rut-instructor"
                  value={selectedInstructor?.rut ?? ""}
                  placeholder="Se completa automaticamente"
                  readOnly
                  type="text"
                />
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="perfil">
                  Codigo perfil CV
                </label>
                <input
                  className="text-field text-field-readonly"
                  id="perfil"
                  value={selectedInstructor?.profileCode ?? ""}
                  placeholder="Se completa automaticamente"
                  readOnly
                  type="text"
                />
              </div>
            </div>

            <div className="field-row">
              <div className="field-group">
                <label className="field-label" htmlFor="fecha">
                  Fecha de certificacion
                </label>
                <div className="date-picker">
                  <button
                    type="button"
                    id="fecha"
                    className="text-field date-trigger"
                    onClick={() => setIsDatePickerOpen((current) => !current)}
                  >
                    <span>{formatDateForDisplay(date)}</span>
                    <span className="date-trigger-icon" aria-hidden="true">
                      ▾
                    </span>
                  </button>

                  {isDatePickerOpen ? (
                    <div className="date-popover">
                      <div className="date-popover-header">
                        <button
                          type="button"
                          className="calendar-nav-button"
                          onClick={() =>
                            setCalendarViewDate(
                              (current) => new Date(current.getFullYear(), current.getMonth() - 1, 1)
                            )
                          }
                        >
                          ‹
                        </button>
                        <div className="calendar-selectors">
                          <select
                            className="calendar-select"
                            value={calendarViewDate.getMonth()}
                            onChange={(event) =>
                              setCalendarViewDate(
                                (current) =>
                                  new Date(
                                    current.getFullYear(),
                                    Number(event.target.value),
                                    1
                                  )
                              )
                            }
                          >
                            {monthOptions.map((month, index) => (
                              <option key={month} value={index}>
                                {month}
                              </option>
                            ))}
                          </select>

                          <select
                            className="calendar-select"
                            value={calendarViewDate.getFullYear()}
                            onChange={(event) =>
                              setCalendarViewDate(
                                (current) =>
                                  new Date(
                                    Number(event.target.value),
                                    current.getMonth(),
                                    1
                                  )
                              )
                            }
                          >
                            {yearOptions.map((year) => (
                              <option key={year} value={year}>
                                {year}
                              </option>
                            ))}
                          </select>
                        </div>
                        <button
                          type="button"
                          className="calendar-nav-button"
                          onClick={() =>
                            setCalendarViewDate(
                              (current) => new Date(current.getFullYear(), current.getMonth() + 1, 1)
                            )
                          }
                        >
                          ›
                        </button>
                      </div>

                      <div className="calendar-weekdays">
                        {["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"].map((day) => (
                          <span key={day}>{day}</span>
                        ))}
                      </div>

                      <div className="calendar-grid">
                        {calendarDays.map((calendarDay) => {
                          const value = formatDateValue(calendarDay.value);
                          const isSelected = value === formatDateValue(selectedCalendarDate);

                          return (
                            <button
                              key={calendarDay.key}
                              type="button"
                              className={
                                isSelected
                                  ? "calendar-day calendar-day-selected"
                                  : calendarDay.inMonth
                                    ? "calendar-day"
                                    : "calendar-day calendar-day-muted"
                              }
                              onClick={() => {
                                setDate(value);
                                setCalendarViewDate(
                                  new Date(
                                    calendarDay.value.getFullYear(),
                                    calendarDay.value.getMonth(),
                                    1
                                  )
                                );
                                setIsDatePickerOpen(false);
                              }}
                            >
                              {calendarDay.value.getDate()}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="hora">
                  Hora
                </label>
                <input
                  className="text-field"
                  id="hora"
                  value={time}
                  onChange={(event) => setTime(event.target.value)}
                  type="time"
                />
              </div>
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="trabajador">
                Trabajador
              </label>
              <input
                className="text-field"
                id="trabajador"
                list={workerListId}
                value={selectedWorkerLabel}
                onChange={(event) => setSelectedWorkerLabel(event.target.value)}
                placeholder="Busque el trabajador por nombre o rut"
                type="text"
              />
              <datalist id={workerListId}>
                {workerOptions.map((worker) => (
                  <option key={worker.id} value={worker.label} />
                ))}
              </datalist>
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="rut-trabajador">
                Rut trabajador
              </label>
              <input
                className="text-field text-field-readonly"
                id="rut-trabajador"
                value={selectedWorker?.rut ?? ""}
                placeholder="Se completa automaticamente"
                readOnly
                type="text"
              />
            </div>

            <div className="field-row">
              <div className="field-group">
                <label className="field-label" htmlFor="marca">
                  Marca
                </label>
                <select
                  className="text-field"
                  id="marca"
                  value={selectedBrand}
                  onChange={(event) => setSelectedBrand(event.target.value)}
                >
                  <option value="">Seleccione marca</option>
                  {brandOptions.map((brand) => (
                    <option key={brand} value={brand}>
                      {brand}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="tipo">
                  Tipo
                </label>
                <select
                  className="text-field"
                  disabled={!selectedBrand}
                  id="tipo"
                  value={selectedType}
                  onChange={(event) => setSelectedType(event.target.value)}
                >
                  <option value="">Seleccione tipo</option>
                  {availableTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="modelo1">
                Modelo principal
              </label>
              <select
                className="text-field"
                disabled={!selectedBrand || !selectedType}
                id="modelo1"
                value={selectedModel1}
                onChange={(event) => setSelectedModel1(event.target.value)}
              >
                <option value="">Seleccione el modelo</option>
                {availableModels.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </div>

            <div className="field-row">
              <div className="field-group">
                <label className="field-label" htmlFor="modelo2">
                  Modelo complementario <span className="field-label-optional">(Opcional)</span>
                </label>
                <select
                  className="text-field"
                  disabled={!selectedModel1}
                  id="modelo2"
                  value={selectedModel2}
                  onChange={(event) => setSelectedModel2(event.target.value)}
                >
                  <option value="">Opcional</option>
                  {availableModels
                    .filter((model) => model !== selectedModel1)
                    .map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                </select>
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="modelo3">
                  Modelo complementario 2{" "}
                  <span className="field-label-optional">(Opcional)</span>
                </label>
                <select
                  className="text-field"
                  disabled={!selectedModel1}
                  id="modelo3"
                  value={selectedModel3}
                  onChange={(event) => setSelectedModel3(event.target.value)}
                >
                  <option value="">Opcional</option>
                  {availableModels
                    .filter((model) => ![selectedModel1, selectedModel2].includes(model))
                    .map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="evaluacion">
                Evaluacion
              </label>
              <div className="field-with-suffix">
                <input
                  className="text-field text-field-with-suffix"
                  id="evaluacion"
                  value={evaluationValue}
                  onChange={(event) =>
                    setEvaluationValue(normalizeEvaluationInput(event.target.value))
                  }
                  placeholder="Ingrese porcentaje"
                  type="text"
                  inputMode="numeric"
                />
                <span className="field-suffix" aria-hidden="true">
                  %
                </span>
              </div>
            </div>

            <div className="action-row">
              <button
                className="soft-primary-button"
                disabled={!isSubmitEnabled}
                onClick={handleSubmit}
                type="button"
              >
                Generar certificado
              </button>
            </div>

            {localStatus ? <p className="form-status">{localStatus}</p> : null}
          </div>

          <aside className="summary-panel">
            <span className="micro-label section-chip">Resumen de solicitud</span>
            <div className="summary-grid">
              <div>
                <small>Instructor</small>
                <strong>{selectedInstructor?.fullName ?? "Sin seleccionar"}</strong>
              </div>
              <div>
                <small>Trabajador</small>
                <strong>{selectedWorker?.fullName ?? "Sin seleccionar"}</strong>
              </div>
              <div>
                <small>Marca</small>
                <strong>{selectedBrand || "Sin seleccionar"}</strong>
              </div>
              <div>
                <small>Tipo</small>
                <strong>{selectedType || "Sin seleccionar"}</strong>
              </div>
              <div>
                <small>Modelos</small>
                <strong>{modelsSummary || "Sin seleccionar"}</strong>
              </div>
              <div>
                <small>Autorizacion para operar equipo</small>
                <strong className="status-inline">
                  <img
                    alt=""
                    className="status-inline-icon"
                    src={currentAuthorizationMeta.icon}
                  />
                  <span>{currentAuthorizationMeta.label}</span>
                </strong>
              </div>
              <div>
                <small>Estado del Certificado</small>
                <strong>Solicitado</strong>
              </div>
            </div>
          </aside>
        </div>

        {generatedRequest ? (
          <section className="generated-request-panel">
            <div className="generated-request-header">
              <span className="micro-label">Ultima Solicitud Realizada</span>
              <h3>Resumen del Certificado</h3>
            </div>

            <div className="generated-request-grid">
              <div>
                <small>Correlativo</small>
                <strong>{generatedRequest.correlativo}</strong>
              </div>
              <div>
                <small>Folio</small>
                <strong>{generatedRequest.folio}</strong>
              </div>
              <div>
                <small>Estado</small>
                <strong>{generatedRequest.estadoCertificado}</strong>
              </div>
              <div>
                <small>Instructor</small>
                <strong>{generatedRequest.instructor}</strong>
              </div>
              <div>
                <small>Rut instructor</small>
                <strong>{generatedRequest.rutInstructor}</strong>
              </div>
              <div>
                <small>Codigo perfil CV</small>
                <strong>{generatedRequest.codigoPerfilCv}</strong>
              </div>
              <div>
                <small>Fecha certificacion</small>
                <strong>{generatedRequest.fechaCertificacion}</strong>
              </div>
              <div>
                <small>Hora</small>
                <strong>{generatedRequest.horaCertificacion}</strong>
              </div>
              <div>
                <small>Trabajador</small>
                <strong>{generatedRequest.trabajador}</strong>
              </div>
              <div>
                <small>Rut trabajador</small>
                <strong>{generatedRequest.rutTrabajador}</strong>
              </div>
              <div>
                <small>Marca</small>
                <strong>{generatedRequest.marca}</strong>
              </div>
              <div>
                <small>Tipo</small>
                <strong>{generatedRequest.tipo || "Sin tipo"}</strong>
              </div>
              <div>
                <small>Modelos</small>
                <strong>{generatedRequest.modelosTodos}</strong>
              </div>
              <div>
                <small>Evaluacion</small>
                <strong>{generatedRequest.evaluacion}</strong>
              </div>
            </div>
          </section>
        ) : null}
      </section>
    </section>
  );
}
