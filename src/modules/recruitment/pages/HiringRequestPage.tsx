import { useMemo, useState } from "react";
import { useAuth } from "../../auth/context/AuthContext";
import {
  type ContractCatalogItem,
  type HiringRole,
  type ShiftCatalogItem
} from "../services/hiringCatalogs";
import { useHiringCatalogs } from "../hooks/useRecruitmentQueries";
import { createHiringRequest } from "../services/hiringRequests";
import {
  toTodayDateValue,
  formatDateForDisplay,
  addThreeMonths,
  parseDateValue,
  formatDateValue,
  buildCalendarDays
} from "../../../shared/lib/date";
import {
  PageShell,
  TextField,
  SelectField,
  DatePickerField
} from "../../../shared/ui";

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
  const {
    data: catalogsData,
    isLoading: isCatalogsLoading,
    error: catalogsQueryError
  } = useHiringCatalogs();
  const hiringRoles = (catalogsData?.hiringRoles ?? []) as HiringRole[];
  const contractCatalog = (catalogsData?.contractCatalog ?? []) as ContractCatalogItem[];
  const shiftCatalog = (catalogsData?.shiftCatalog ?? []) as ShiftCatalogItem[];
  const catalogsError =
    catalogsQueryError instanceof Error ? catalogsQueryError.message : "";

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
      value: rentaLiquidaOfrecida
        ? `$ ${formatCurrencyDisplay(rentaLiquidaOfrecida)}`
        : "Pendiente"
    },
    { label: "Turno", value: turno || "Pendiente" }
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
      estadoSolicitud: "Pendiente gerente de area",
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
      `Solicitud ${creationResult.data.folio} guardada en Supabase. Quedó enviada a Gerente de Area como primera etapa de aprobación.`
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
    <PageShell useFormShell>
      <div className="minimal-page-header">
        <h1>Solicitud de Contrataciones</h1>
      </div>
      <div className="hiring-layout-grid">
        <div className="hiring-main-column">

          <div className="form-card">
            <div className="requester-grid">
              <TextField
                id="solicitante-nombre"
                label="Nombre solicitante"
                value={displayName}
                readOnly
              />
              <TextField
                id="solicitante-cargo"
                label="Cargo solicitante"
                value={jobTitle}
                readOnly
              />
            </div>

            <div className="request-primary-grid">
              <SelectField
                id="cargo-solicitado"
                label="Cargo solicitado"
                className="request-primary-grid-wide"
                value={cargoSolicitado}
                onChange={(e) => setCargoSolicitado(e.target.value)}
                disabled={isCatalogsLoading || Boolean(catalogsError)}
                options={hiringRoles.map((role) => ({ value: role.name, label: role.name }))}
                placeholder="Seleccione el cargo"
              />

              <TextField
                id="numero-vacantes"
                label="Numero de Vacantes"
                type="number"
                min="1"
                step="1"
                value={numeroVacantes}
                onChange={(e) => setNumeroVacantes(e.target.value)}
              />

              <DatePickerField
                id="fecha-solicitada-ingreso"
                label="Fecha solicitada ingreso"
                value={fechaSolicitadaIngreso}
                onChange={setFechaSolicitadaIngreso}
              />
            </div>

            <div className="contract-grid">
              <SelectField
                id="nombre-contrato"
                label="Nombre de contrato"
                value={nombreContrato}
                onChange={(e) => setNombreContrato(e.target.value)}
                disabled={isCatalogsLoading || Boolean(catalogsError)}
                options={contractOptions.map((c) => ({ value: c.contractName, label: c.contractName }))}
                placeholder="Seleccione el contrato"
              />

              <TextField
                id="numero-contrato"
                label="Numero contrato"
                value={selectedContract?.contractNumber ?? ""}
                placeholder="Se completa automaticamente"
                readOnly
              />
            </div>

            <div className="schedule-grid">
              <DatePickerField
                id="fecha-inicio"
                label="Fecha inicio"
                value={fechaInicio}
                onChange={setFechaInicio}
              />

              <TextField
                id="fecha-termino"
                label="Fecha termino"
                value={formatDateForDisplay(fechaTermino)}
                placeholder="Se calcula automaticamente"
                readOnly
              />

              <SelectField
                id="turno"
                label="Turno"
                value={turno}
                onChange={(e) => setTurno(e.target.value)}
                disabled={isCatalogsLoading || Boolean(catalogsError)}
                options={shiftCatalog.map((shift) => ({ value: shift.name, label: shift.name }))}
                placeholder="Seleccione el turno"
              />
            </div>

            <div className="support-grid">
              <SelectField
                id="campamento"
                label="Campamento"
                value={campamento}
                onChange={(e) => setCampamento(e.target.value)}
                options={yesNoOptions.map((opt) => ({ value: opt, label: opt }))}
                placeholder="Seleccione"
              />

              <SelectField
                id="pasajes"
                label="Pasajes"
                value={pasajes}
                onChange={(e) => setPasajes(e.target.value)}
                options={yesNoOptions.map((opt) => ({ value: opt, label: opt }))}
                placeholder="Seleccione"
              />

              <div className="field-group">
                <label className="field-label" htmlFor="renta-liquida">
                  Renta liquida ofrecida
                </label>
                <div className="field-with-suffix">
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
            </div>

            <div className="field-group field-pair">
              <TextField
                id="unidad-costo"
                label="Unidad de costo"
                value={selectedContract?.costUnit ?? ""}
                placeholder="Se completa automaticamente"
                readOnly
              />
              <TextField
                id="nombre-unidad-costo"
                label="Nombre unidad de costo"
                value={selectedContract?.costUnitName ?? ""}
                placeholder="Se calcula automaticamente"
                readOnly
              />
            </div>

            <div className="field-group field-pair">
              <TextField
                id="codigo-centro-costo"
                label="Codigo centro de costo"
                value={selectedContract?.costCenterCode ?? ""}
                placeholder="Se completa automaticamente"
                readOnly
              />
              <TextField
                id="nombre-centro-costo"
                label="Nombre centro de costo"
                value={selectedContract?.costCenterName ?? ""}
                placeholder="Se completa automaticamente"
                readOnly
              />
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
    </PageShell>
  );
}
