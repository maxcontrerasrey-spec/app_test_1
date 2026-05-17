import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth/context/AuthContext";
import {
  fetchHiringCatalogs,
  type ContractCatalogItem,
  type HiringRole,
  type ShiftCatalogItem
} from "../services/hiringCatalogs";
import { createHiringRequest } from "../services/hiringRequests";

type GeneratedHiringRequest = {
  folio: string;
  fechaSolicitud: string;
  estadoSolicitud: string;
  solicitanteNombre: string;
  solicitanteCargo: string;
  solicitanteCorreo: string;
  fechaSolicitadaIngreso: string;
  cargoSolicitado: string;
  numeroVacantes: string;
  nombreContrato: string;
  numeroContrato: string;
  nombreUnidadCosto: string;
  unidadCosto: string;
  nombreCentroCosto: string;
  codigoCentroCosto: string;
  fechaInicio: string;
  fechaTermino: string;
  campamento: string;
  pasajes: string;
  otrosBeneficios: string;
  rentaLiquidaOfrecida: string;
  turno: string;
  solicitanteFirmado: string;
};

const yesNoOptions = ["Si", "No"];
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

const HIRING_REQUEST_BUILD_MARKER = "HR-BUILD-2026-05-16-01";

function toTodayDateValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}

function formatDateForDisplay(dateValue: string) {
  const [year, month, day] = dateValue.split("-");
  if (!year || !month || !day) {
    return "";
  }

  return `${day}/${month}/${year}`;
}

function addThreeMonths(dateValue: string) {
  if (!dateValue) {
    return "";
  }

  const [year, month, day] = dateValue.split("-").map(Number);
  const targetMonthIndex = month - 1 + 3;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const targetMonth = targetMonthIndex % 12;
  const lastDayOfTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  const targetDay = Math.min(day, lastDayOfTargetMonth);

  return `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}-${String(
    targetDay
  ).padStart(2, "0")}`;
}

function parseDateValue(dateValue: string) {
  const [year, month, day] = dateValue.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDateValue(dateObject: Date) {
  return `${dateObject.getFullYear()}-${String(dateObject.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(dateObject.getDate()).padStart(2, "0")}`;
}

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

function normalizeCurrencyInput(rawValue: string) {
  const digits = rawValue.replace(/\D/g, "");
  return digits ? String(Number(digits)) : "";
}

function formatCurrencyDisplay(value: string) {
  if (!value) {
    return "";
  }

  return new Intl.NumberFormat("es-CL").format(Number(value));
}

export function HiringRequestPage() {
  const { displayName, jobTitle, email } = useAuth();
  const todayValue = toTodayDateValue();
  const currentYear = new Date().getFullYear();
  const [hiringRoles, setHiringRoles] = useState<HiringRole[]>([]);
  const [contractCatalog, setContractCatalog] = useState<ContractCatalogItem[]>([]);
  const [shiftCatalog, setShiftCatalog] = useState<ShiftCatalogItem[]>([]);
  const [isCatalogsLoading, setIsCatalogsLoading] = useState(true);
  const [catalogsError, setCatalogsError] = useState("");
  const [fechaSolicitadaIngreso, setFechaSolicitadaIngreso] = useState("");
  const [cargoSolicitado, setCargoSolicitado] = useState("");
  const [numeroVacantes, setNumeroVacantes] = useState("1");
  const [nombreContrato, setNombreContrato] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [campamento, setCampamento] = useState("");
  const [pasajes, setPasajes] = useState("");
  const [otrosBeneficios, setOtrosBeneficios] = useState("");
  const [rentaLiquidaOfrecida, setRentaLiquidaOfrecida] = useState("");
  const [turno, setTurno] = useState("");
  const [solicitanteFirmado, setSolicitanteFirmado] = useState(false);
  const [isSavingRequest, setIsSavingRequest] = useState(false);
  const [localStatus, setLocalStatus] = useState("");
  const [isRequestedDatePickerOpen, setIsRequestedDatePickerOpen] = useState(false);
  const [requestedDateView, setRequestedDateView] = useState(() =>
    parseDateValue(todayValue)
  );
  const [isStartDatePickerOpen, setIsStartDatePickerOpen] = useState(false);
  const [startDateView, setStartDateView] = useState(() => parseDateValue(todayValue));
  const [generatedRequest, setGeneratedRequest] =
    useState<GeneratedHiringRequest | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadCatalogs = async () => {
      setIsCatalogsLoading(true);
      const result = await fetchHiringCatalogs();

      if (!isMounted) {
        return;
      }

      setHiringRoles(result.hiringRoles);
      setContractCatalog(result.contractCatalog);
      setShiftCatalog(result.shiftCatalog);
      setCatalogsError(result.error ?? "");
      setIsCatalogsLoading(false);
    };

    void loadCatalogs();

    return () => {
      isMounted = false;
    };
  }, []);

  const contractOptions = useMemo(
    () =>
      [...contractCatalog].sort((left, right) =>
        left.contractName.localeCompare(right.contractName, "es")
      ),
    [contractCatalog]
  );

  const selectedContract =
    contractOptions.find((contract) => contract.contractName === nombreContrato) ?? null;
  const fechaTermino = addThreeMonths(fechaInicio);
  const selectedRequestedDate = fechaSolicitadaIngreso
    ? parseDateValue(fechaSolicitadaIngreso)
    : parseDateValue(todayValue);
  const selectedStartDate = fechaInicio
    ? parseDateValue(fechaInicio)
    : parseDateValue(todayValue);
  const requestedDateCalendarDays = buildCalendarDays(requestedDateView);
  const startDateCalendarDays = buildCalendarDays(startDateView);
  const yearOptions = Array.from({ length: 9 }, (_, index) => currentYear - 1 + index);

  const isSubmitEnabled =
    !isCatalogsLoading &&
    !catalogsError &&
    Boolean(fechaSolicitadaIngreso) &&
    Boolean(cargoSolicitado) &&
    Boolean(numeroVacantes) &&
    Number(numeroVacantes) > 0 &&
    Boolean(nombreContrato) &&
    Boolean(fechaInicio) &&
    Boolean(fechaTermino) &&
    Boolean(campamento) &&
    Boolean(pasajes) &&
    Boolean(rentaLiquidaOfrecida) &&
    Boolean(turno) &&
    solicitanteFirmado;

  const summaryRows = [
    { label: "Solicitante", value: displayName },
    { label: "Cargo solicitante", value: jobTitle },
    { label: "Cargo solicitado", value: cargoSolicitado || "Pendiente" },
    { label: "Contrato", value: nombreContrato || "Pendiente" },
    { label: "Fecha inicio", value: formatDateForDisplay(fechaInicio) || "Pendiente" },
    { label: "Fecha termino", value: formatDateForDisplay(fechaTermino) || "Pendiente" },
    {
      label: "Renta liquida",
      value: rentaLiquidaOfrecida ? `$ ${formatCurrencyDisplay(rentaLiquidaOfrecida)}` : "Pendiente"
    },
    { label: "Turno", value: turno || "Pendiente" },
    {
      label: "Firma solicitante",
      value: solicitanteFirmado ? "Confirmada" : "Pendiente"
    },
    { label: "Estado solicitud", value: "Pendiente" }
  ];

  const generatedRows = useMemo(
    () =>
      generatedRequest
        ? [
            { label: "Folio", value: generatedRequest.folio },
            { label: "Fecha solicitud", value: generatedRequest.fechaSolicitud },
            { label: "Estado", value: generatedRequest.estadoSolicitud },
            { label: "Solicitante", value: generatedRequest.solicitanteNombre },
            { label: "Cargo solicitado", value: generatedRequest.cargoSolicitado },
            { label: "Numero vacantes", value: generatedRequest.numeroVacantes },
            { label: "Contrato", value: generatedRequest.nombreContrato },
            { label: "Numero contrato", value: generatedRequest.numeroContrato },
            { label: "Unidad costo", value: generatedRequest.unidadCosto },
            { label: "Centro costo", value: generatedRequest.nombreCentroCosto },
            { label: "Fecha inicio", value: generatedRequest.fechaInicio },
            { label: "Fecha termino", value: generatedRequest.fechaTermino },
            { label: "Campamento", value: generatedRequest.campamento },
            { label: "Pasajes", value: generatedRequest.pasajes },
            { label: "Turno", value: generatedRequest.turno },
            {
              label: "Renta liquida ofrecida",
              value: `$ ${formatCurrencyDisplay(generatedRequest.rentaLiquidaOfrecida)}`
            },
            {
              label: "Firma solicitante",
              value: generatedRequest.solicitanteFirmado
            }
          ]
        : [],
    [generatedRequest]
  );

  const handleSubmit = async () => {
    if (!isSubmitEnabled || !selectedContract) {
      setGeneratedRequest(null);
      setLocalStatus("Complete los campos obligatorios y confirme la firma digital.");
      return;
    }

    const selectedJobPosition =
      hiringRoles.find((role) => role.name === cargoSolicitado) ?? null;
    const selectedShift = shiftCatalog.find((shift) => shift.name === turno) ?? null;

    if (!selectedJobPosition || !selectedShift) {
      setGeneratedRequest(null);
      setLocalStatus("No fue posible resolver todos los catálogos de la solicitud.");
      return;
    }

    setIsSavingRequest(true);
    const creationResult = await createHiringRequest({
      requestedEntryDate: fechaSolicitadaIngreso,
      jobPosition: selectedJobPosition,
      vacancies: Number(numeroVacantes),
      contract: selectedContract,
      startDate: fechaInicio,
      endDate: fechaTermino,
      campamento: campamento === "Si",
      pasajes: pasajes === "Si",
      otherBenefits: otrosBeneficios,
      salaryOffer: Number(rentaLiquidaOfrecida),
      shift: selectedShift,
      requesterSigned: solicitanteFirmado
    });

    if (creationResult.error || !creationResult.data) {
      setGeneratedRequest(null);
      setLocalStatus(
        creationResult.error ?? "No fue posible guardar la solicitud en Supabase."
      );
      setIsSavingRequest(false);
      return;
    }

    const request: GeneratedHiringRequest = {
      folio: creationResult.data.folio,
      fechaSolicitud: formatDateForDisplay(toTodayDateValue()),
      estadoSolicitud: "Pendiente",
      solicitanteNombre: displayName,
      solicitanteCargo: jobTitle,
      solicitanteCorreo: email,
      fechaSolicitadaIngreso: formatDateForDisplay(fechaSolicitadaIngreso),
      cargoSolicitado,
      numeroVacantes,
      nombreContrato,
      numeroContrato: selectedContract.contractNumber,
      nombreUnidadCosto: selectedContract.costUnitName,
      unidadCosto: selectedContract.costUnit,
      nombreCentroCosto: selectedContract.costCenterName,
      codigoCentroCosto: selectedContract.costCenterCode,
      fechaInicio: formatDateForDisplay(fechaInicio),
      fechaTermino: formatDateForDisplay(fechaTermino),
      campamento,
      pasajes,
      otrosBeneficios,
      rentaLiquidaOfrecida,
      turno,
      solicitanteFirmado: "Si"
    };

    setGeneratedRequest(request);
    setLocalStatus(
      `Solicitud ${creationResult.data.folio} guardada en Supabase. Permanecerá pendiente mientras falten aprobaciones requeridas.`
    );
    setFechaSolicitadaIngreso("");
    setCargoSolicitado("");
    setNumeroVacantes("1");
    setNombreContrato("");
    setFechaInicio("");
    setCampamento("");
    setPasajes("");
    setOtrosBeneficios("");
    setRentaLiquidaOfrecida("");
    setTurno("");
    setSolicitanteFirmado(false);
    setIsRequestedDatePickerOpen(false);
    setRequestedDateView(parseDateValue(todayValue));
    setIsStartDatePickerOpen(false);
    setStartDateView(parseDateValue(todayValue));
    setIsSavingRequest(false);
  };

  return (
    <section className="page">
      <section className="form-shell">
        <div className="form-header-grid">
          <div className="hero-panel form-copy form-hero">
            <span className="eyebrow">Reclutamiento</span>
            <span className="build-marker">{HIRING_REQUEST_BUILD_MARKER}</span>
            <h2>Solicitud de Contrataciones</h2>
            <p className="hero-copy">
              Complete los campos obligatorios de la solicitud para registrar una nueva
              contratacion y dejarla lista para aprobacion.
            </p>
            <p className="hero-copy">
              {isCatalogsLoading
                ? "Cargando catálogos desde Supabase."
                : catalogsError
                  ? catalogsError
                  : "Catálogos operativos cargados desde Supabase."}
            </p>
          </div>

          <aside className="summary-panel">
            <span className="section-chip">Resumen de solicitud</span>
            <div className="summary-grid">
              {summaryRows.map((row) => (
                <div key={row.label}>
                  <small>{row.label}</small>
                  <strong>{row.value}</strong>
                </div>
              ))}
            </div>
          </aside>
        </div>

        <div className="form-workspace form-workspace-single">
          <div className="form-card">
              <div className="requester-grid">
                <div className="field-group">
                  <label className="field-label" htmlFor="solicitante-nombre">
                    Nombre solicitante
                  </label>
                  <input
                    className="text-field text-field-readonly"
                    id="solicitante-nombre"
                    value={displayName}
                    readOnly
                    type="text"
                  />
                </div>

                <div className="field-group">
                  <label className="field-label" htmlFor="solicitante-cargo">
                    Cargo solicitante
                  </label>
                  <input
                    className="text-field text-field-readonly"
                    id="solicitante-cargo"
                    value={jobTitle}
                    readOnly
                    type="text"
                  />
                </div>

                <div className="field-group">
                  <label className="field-label" htmlFor="solicitante-correo">
                    Correo solicitante
                  </label>
                  <input
                    className="text-field text-field-readonly"
                    id="solicitante-correo"
                    value={email}
                    readOnly
                    type="email"
                  />
                </div>
              </div>

              <div className="request-primary-grid">
                <div className="field-group request-primary-grid-wide">
                  <label className="field-label" htmlFor="cargo-solicitado">
                    Cargo solicitado
                  </label>
                  <select
                    className="text-field"
                    id="cargo-solicitado"
                    disabled={isCatalogsLoading || Boolean(catalogsError)}
                    value={cargoSolicitado}
                    onChange={(event) => setCargoSolicitado(event.target.value)}
                  >
                    <option value="">Seleccione el cargo</option>
                    {hiringRoles.map((role) => (
                      <option key={role.id} value={role.name}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field-group">
                  <label className="field-label" htmlFor="numero-vacantes">
                    Numero de Vacantes
                  </label>
                  <input
                    className="text-field"
                    id="numero-vacantes"
                    min="1"
                    step="1"
                    value={numeroVacantes}
                    onChange={(event) => setNumeroVacantes(event.target.value)}
                    type="number"
                  />
                </div>

                <div className="field-group">
                  <label className="field-label" htmlFor="fecha-solicitada-ingreso">
                    Fecha solicitada ingreso
                  </label>
                  <div className="date-picker">
                    <button
                      type="button"
                      id="fecha-solicitada-ingreso"
                      className="text-field date-trigger"
                      onClick={() => setIsRequestedDatePickerOpen((current) => !current)}
                    >
                      <span>
                        {fechaSolicitadaIngreso
                          ? formatDateForDisplay(fechaSolicitadaIngreso)
                          : "Seleccione la fecha"}
                      </span>
                      <span className="date-trigger-icon" aria-hidden="true">
                        ▾
                      </span>
                    </button>

                    {isRequestedDatePickerOpen ? (
                      <div className="date-popover">
                        <div className="date-popover-header">
                          <button
                            type="button"
                            className="calendar-nav-button"
                            onClick={() =>
                              setRequestedDateView(
                                (current) =>
                                  new Date(current.getFullYear(), current.getMonth() - 1, 1)
                              )
                            }
                          >
                            ‹
                          </button>
                          <div className="calendar-selectors">
                            <select
                              className="calendar-select"
                              value={requestedDateView.getMonth()}
                              onChange={(event) =>
                                setRequestedDateView(
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
                              value={requestedDateView.getFullYear()}
                              onChange={(event) =>
                                setRequestedDateView(
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
                              setRequestedDateView(
                                (current) =>
                                  new Date(current.getFullYear(), current.getMonth() + 1, 1)
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
                          {requestedDateCalendarDays.map((calendarDay) => {
                            const value = formatDateValue(calendarDay.value);
                            const isSelected =
                              value === formatDateValue(selectedRequestedDate);
                            const isBeforeToday = value < todayValue;

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
                                disabled={isBeforeToday}
                                onClick={() => {
                                  setFechaSolicitadaIngreso(value);
                                  setRequestedDateView(
                                    new Date(
                                      calendarDay.value.getFullYear(),
                                      calendarDay.value.getMonth(),
                                      1
                                    )
                                  );
                                  setIsRequestedDatePickerOpen(false);
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
              </div>

            <div className="contract-grid">
              <div className="field-group">
                <label className="field-label" htmlFor="nombre-contrato">
                  Nombre de contrato
                </label>
                <select
                  className="text-field"
                  id="nombre-contrato"
                  disabled={isCatalogsLoading || Boolean(catalogsError)}
                  value={nombreContrato}
                  onChange={(event) => setNombreContrato(event.target.value)}
                >
                  <option value="">Seleccione el contrato</option>
                  {contractOptions.map((contract) => (
                    <option key={contract.id} value={contract.contractName}>
                      {contract.contractName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="numero-contrato">
                  Numero contrato
                </label>
                <input
                  className="text-field text-field-readonly"
                  id="numero-contrato"
                  value={selectedContract?.contractNumber ?? ""}
                  placeholder="Se completa automaticamente"
                  readOnly
                  type="text"
                />
              </div>
            </div>

            <div className="field-group field-pair">
              <div className="field-group">
                <label className="field-label" htmlFor="unidad-costo">
                  Unidad de costo
                </label>
                <input
                  className="text-field text-field-readonly"
                  id="unidad-costo"
                  value={selectedContract?.costUnit ?? ""}
                  placeholder="Se completa automaticamente"
                  readOnly
                  type="text"
                />
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="nombre-unidad-costo">
                  Nombre unidad de costo
                </label>
                <input
                  className="text-field text-field-readonly"
                  id="nombre-unidad-costo"
                  value={selectedContract?.costUnitName ?? ""}
                  placeholder="Se completa automaticamente"
                  readOnly
                  type="text"
                />
              </div>
            </div>

            <div className="field-group field-pair">
              <div className="field-group">
                <label className="field-label" htmlFor="codigo-centro-costo">
                  Codigo centro de costo
                </label>
                <input
                  className="text-field text-field-readonly"
                  id="codigo-centro-costo"
                  value={selectedContract?.costCenterCode ?? ""}
                  placeholder="Se completa automaticamente"
                  readOnly
                  type="text"
                />
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="nombre-centro-costo">
                  Nombre centro de costo
                </label>
                <input
                  className="text-field text-field-readonly"
                  id="nombre-centro-costo"
                  value={selectedContract?.costCenterName ?? ""}
                  placeholder="Se completa automaticamente"
                  readOnly
                  type="text"
                />
              </div>
            </div>

            <div className="schedule-grid">
              <div className="field-group">
                <label className="field-label" htmlFor="fecha-inicio">
                  Fecha inicio
                </label>
                <div className="date-picker">
                  <button
                    type="button"
                    id="fecha-inicio"
                    className="text-field date-trigger"
                    onClick={() => setIsStartDatePickerOpen((current) => !current)}
                  >
                    <span>
                      {fechaInicio ? formatDateForDisplay(fechaInicio) : "Seleccione la fecha"}
                    </span>
                    <span className="date-trigger-icon" aria-hidden="true">
                      ▾
                    </span>
                  </button>

                  {isStartDatePickerOpen ? (
                    <div className="date-popover">
                      <div className="date-popover-header">
                        <button
                          type="button"
                          className="calendar-nav-button"
                          onClick={() =>
                            setStartDateView(
                              (current) =>
                                new Date(current.getFullYear(), current.getMonth() - 1, 1)
                            )
                          }
                        >
                          ‹
                        </button>
                        <div className="calendar-selectors">
                          <select
                            className="calendar-select"
                            value={startDateView.getMonth()}
                            onChange={(event) =>
                              setStartDateView(
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
                            value={startDateView.getFullYear()}
                            onChange={(event) =>
                              setStartDateView(
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
                            setStartDateView(
                              (current) =>
                                new Date(current.getFullYear(), current.getMonth() + 1, 1)
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
                        {startDateCalendarDays.map((calendarDay) => {
                          const value = formatDateValue(calendarDay.value);
                          const isSelected = value === formatDateValue(selectedStartDate);
                          const isBeforeToday = value < todayValue;

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
                              disabled={isBeforeToday}
                              onClick={() => {
                                setFechaInicio(value);
                                setStartDateView(
                                  new Date(
                                    calendarDay.value.getFullYear(),
                                    calendarDay.value.getMonth(),
                                    1
                                  )
                                );
                                setIsStartDatePickerOpen(false);
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
                <label className="field-label" htmlFor="fecha-termino">
                  Fecha termino
                </label>
                <input
                  className="text-field text-field-readonly"
                  id="fecha-termino"
                  value={formatDateForDisplay(fechaTermino)}
                  placeholder="Se calcula automaticamente"
                  readOnly
                  type="text"
                />
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="turno">
                  Turno
                </label>
                <select
                  className="text-field"
                  id="turno"
                  disabled={isCatalogsLoading || Boolean(catalogsError)}
                  value={turno}
                  onChange={(event) => setTurno(event.target.value)}
                >
                  <option value="">Seleccione el turno</option>
                  {shiftCatalog.map((shift) => (
                    <option key={shift.id} value={shift.name}>
                      {shift.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="support-grid">
              <div className="field-group">
                <label className="field-label" htmlFor="campamento">
                  Campamento
                </label>
                <select
                  className="text-field"
                  id="campamento"
                  value={campamento}
                  onChange={(event) => setCampamento(event.target.value)}
                >
                  <option value="">Seleccione</option>
                  {yesNoOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="pasajes">
                  Pasajes
                </label>
                <select
                  className="text-field"
                  id="pasajes"
                  value={pasajes}
                  onChange={(event) => setPasajes(event.target.value)}
                >
                  <option value="">Seleccione</option>
                  {yesNoOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field-group field-with-suffix">
                <label className="field-label" htmlFor="renta-liquida">
                  Renta liquida ofrecida
                </label>
                <input
                  className="text-field text-field-with-suffix"
                  id="renta-liquida"
                  inputMode="numeric"
                  value={formatCurrencyDisplay(rentaLiquidaOfrecida)}
                  onChange={(event) =>
                    setRentaLiquidaOfrecida(normalizeCurrencyInput(event.target.value))
                  }
                  placeholder="Ingrese renta liquida"
                  type="text"
                />
                <span className="field-suffix">$</span>
              </div>
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="otros-beneficios">
                Otros beneficios <span className="field-label-optional">(Opcional)</span>
              </label>
              <textarea
                className="text-field text-area-field"
                id="otros-beneficios"
                value={otrosBeneficios}
                onChange={(event) => setOtrosBeneficios(event.target.value)}
                placeholder="Agregue observaciones o beneficios adicionales si aplica"
              />
            </div>

            <div className="signature-panel">
              <label className="signature-checkbox" htmlFor="solicitante-firmado">
                <input
                  id="solicitante-firmado"
                  className="signature-checkbox-input"
                  checked={solicitanteFirmado}
                  onChange={(event) => setSolicitanteFirmado(event.target.checked)}
                  type="checkbox"
                />
                <span>
                  Confirmo que la informacion ingresada es correcta y que esta accion
                  constituye mi firma digital como solicitante.
                </span>
              </label>
            </div>

            <div className="action-row">
              <button
                className="soft-primary-button"
                disabled={!isSubmitEnabled || isSavingRequest}
                onClick={handleSubmit}
                type="button"
              >
                {isSavingRequest ? "Guardando solicitud" : "Enviar solicitud"}
              </button>
            </div>

            {localStatus ? <p className="form-status">{localStatus}</p> : null}
          </div>
        </div>

        {generatedRequest ? (
          <section className="generated-request-panel">
            <div className="generated-request-header">
              <span className="eyebrow">Ultima Solicitud Realizada</span>
              <h3>Resumen de la Contratacion</h3>
            </div>

            <div className="generated-request-grid">
              {generatedRows.map((row) => (
                <div key={row.label}>
                  <small>{row.label}</small>
                  <strong>{row.value}</strong>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </section>
    </section>
  );
}
