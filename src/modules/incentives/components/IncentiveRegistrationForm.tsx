import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { DatePickerField, SelectField, TextField } from "../../../shared/ui";
import { formatCurrencyValue } from "../../../shared/lib/format";
import { formatRut } from "../../../shared/lib/rut";
import { formatDateForDisplay, toTodayDateValue } from "../../../shared/lib/date";
import {
  createHrIncentiveRequest
} from "../services/incentivesApi";
import {
  useHrIncentiveEligibleTypes,
  invalidateHrIncentiveQueries,
  useHrIncentivePreview,
  useHrIncentiveRosterSnapshot,
  useHrIncentiveWorkerContext
} from "../hooks/useIncentivesQueries";
import type {
  HrIncentiveEligibleWorker,
  HrIncentiveRosterSnapshot,
  HrIncentiveSetupCatalogs
} from "../types";
import {
  resolveIncentiveContractMismatch,
  resolveIncentiveRegistrationWindow
} from "../lib/incentiveRules";
import { IncentiveWorkerLookup } from "./IncentiveWorkerLookup";
import { IncentiveOperationalFlags } from "./IncentiveOperationalFlags";

type IncentiveRegistrationFormProps = {
  setupCatalogsQuery: UseQueryResult<HrIncentiveSetupCatalogs, Error>;
};

function buildAreaOptionValue(
  contractCode: string | null,
  areaCode: string | null,
  areaName: string | null
) {
  return [contractCode ?? "", areaCode ?? "", areaName ?? ""].join("::");
}

function EmergencyIcon() {
  return (
    <svg
      aria-hidden="true"
      className="hr-incentives-rule-alert-icon"
      focusable="false"
      viewBox="0 0 20 20"
    >
      <path
        d="M10 1.75 3.15 4.1 1.75 10l1.4 5.9L10 18.25l6.85-2.35 1.4-5.9-1.4-5.9L10 1.75Zm.05 4.2c.5 0 .9.39.9.88v4.52a.9.9 0 0 1-1.8 0V6.83c0-.49.4-.88.9-.88Zm0 8.2a1.03 1.03 0 1 1 0-2.05 1.03 1.03 0 0 1 0 2.05Z"
        fill="currentColor"
      />
    </svg>
  );
}

function IncentiveRuleAlert({ children }: { children: string }) {
  return (
    <div className="hr-incentives-rule-alert" role="alert">
      <div className="hr-incentives-rule-alert-icon-shell" aria-hidden="true">
        <EmergencyIcon />
      </div>
      <div className="hr-incentives-rule-alert-copy">
        <strong className="hr-incentives-rule-alert-title">Bloqueo operativo</strong>
        <span>{children}</span>
      </div>
    </div>
  );
}

function resolveRosterStatusAppearance(snapshot: HrIncentiveRosterSnapshot | null) {
  if (!snapshot) {
    return null;
  }

  if (snapshot.blockedByAbsence) {
    return {
      tone: "danger" as const,
      title: snapshot.scheduleLabel ?? "Vacaciones o licencia médica",
      description: "El sistema bloqueará el registro mientras este estado siga vigente."
    };
  }

  if (snapshot.isRestDay) {
    return {
      tone: "warning" as const,
      title: "En descanso",
      description: "Si registras el incentivo, el calendario operativo quedará marcado como turno adicional."
    };
  }

  if (snapshot.scheduleStatus === "working" || snapshot.scheduleStatus === "extra_shift") {
    return {
      tone: "success" as const,
      title: snapshot.scheduleStatus === "extra_shift" ? "Turno adicional" : "En turno",
      description: "El trabajador figura operativo para la fecha seleccionada."
    };
  }

  if (snapshot.scheduleStatus === "training") {
    return {
      tone: "success" as const,
      title: "Capacitación",
      description: "El trabajador tiene una excepción operativa activa para esa fecha."
    };
  }

  return {
    tone: "neutral" as const,
    title: snapshot.scheduleLabel ?? "Sin pauta",
    description: "No existe una pauta operativa concluyente para la fecha seleccionada."
  };
}

function isReplacementWorkerEligible(snapshot: HrIncentiveRosterSnapshot | null) {
  if (!snapshot) {
    return false;
  }

  return snapshot.scheduleStatus === "working" || snapshot.scheduleStatus === "extra_shift";
}

function buildHourlyRateBreakdownCopy(params: {
  hourRateStrategy: "rule_amount" | "buk_overtime";
  rateSource: "rule_amount" | "buk_payload" | "rule_fallback_salary";
  rateRuleAmount: number;
  rateBaseSalary: number | null;
  rateWeeklyHours: number | null;
  rateOvertimeMultiplier: number | null;
}) {
  const {
    hourRateStrategy,
    rateSource,
    rateRuleAmount,
    rateBaseSalary,
    rateWeeklyHours,
    rateOvertimeMultiplier
  } = params;

  if (hourRateStrategy !== "buk_overtime") {
    return null;
  }

  if (rateSource === "buk_payload" && rateBaseSalary !== null && rateWeeklyHours !== null) {
    return `Valor hora extra calculado desde BUK: ${formatCurrencyValue(rateRuleAmount)} (${formatCurrencyValue(rateBaseSalary)} base / ${rateWeeklyHours} hrs semanales x ${rateOvertimeMultiplier ?? 1.5}).`;
  }

  if (
    rateSource === "rule_fallback_salary" &&
    rateBaseSalary !== null &&
    rateWeeklyHours !== null
  ) {
    return `Valor hora extra calculado desde fallback configurado: ${formatCurrencyValue(rateRuleAmount)} (${formatCurrencyValue(rateBaseSalary)} base / ${rateWeeklyHours} hrs semanales x ${rateOvertimeMultiplier ?? 1.5}).`;
  }

  return `No hubo datos salariales suficientes en BUK; se aplicó el valor hora de respaldo definido en la regla: ${formatCurrencyValue(rateRuleAmount)}.`;
}

export function IncentiveRegistrationForm({
  setupCatalogsQuery
}: IncentiveRegistrationFormProps) {
  const queryClient = useQueryClient();
  const [selectedWorker, setSelectedWorker] = useState<HrIncentiveEligibleWorker | null>(null);
  const [selectedAreaValue, setSelectedAreaValue] = useState("");
  const [selectedIncentiveTypeId, setSelectedIncentiveTypeId] = useState("");
  const [serviceDate, setServiceDate] = useState(toTodayDateValue());
  const [durationHours, setDurationHours] = useState("");
  const [manualAmount, setManualAmount] = useState("");
  const [motive, setMotive] = useState("");
  const [replacementWorker, setReplacementWorker] = useState<HrIncentiveEligibleWorker | null>(null);
  const [formMessage, setFormMessage] = useState("");
  const [formError, setFormError] = useState("");

  const workerContextQuery = useHrIncentiveWorkerContext(
    selectedWorker?.bukEmployeeId ?? "",
    Boolean(selectedWorker)
  );
  const rosterSnapshotQuery = useHrIncentiveRosterSnapshot({
    bukEmployeeId: selectedWorker?.bukEmployeeId ?? "",
    serviceDate,
    enabled: Boolean(selectedWorker) && Boolean(serviceDate)
  });
  const replacementRosterSnapshotQuery = useHrIncentiveRosterSnapshot({
    bukEmployeeId: replacementWorker?.bukEmployeeId ?? "",
    serviceDate,
    enabled: Boolean(replacementWorker) && Boolean(serviceDate)
  });
  const eligibleIncentiveTypesQuery = useHrIncentiveEligibleTypes({
    bukEmployeeId: selectedWorker?.bukEmployeeId ?? "",
    selectedContractCode: selectedAreaValue ? (workerContextQuery.data?.availableAreas ?? []).find(
      (item) =>
        buildAreaOptionValue(item.contractCode, item.areaCode, item.areaName) === selectedAreaValue
    )?.contractCode ?? "" : "",
    serviceDate,
    enabled: Boolean(selectedWorker) && Boolean(selectedAreaValue) && Boolean(serviceDate)
  });

  const incentiveTypes = eligibleIncentiveTypesQuery.data ?? [];

  const selectedIncentiveType = useMemo(
    () => incentiveTypes.find((item) => item.id === selectedIncentiveTypeId) ?? null,
    [incentiveTypes, selectedIncentiveTypeId]
  );

  const areaOptions = useMemo(() => {
    return (workerContextQuery.data?.availableAreas ?? []).map((area) => ({
      value: buildAreaOptionValue(area.contractCode, area.areaCode, area.areaName),
      label: area.isPrimary ? `${area.label} · Activa` : area.label
    }));
  }, [workerContextQuery.data?.availableAreas]);
  const workerIdentity = workerContextQuery.data?.worker ?? null;
  const workerRutValue = useMemo(() => {
    const documentNumber = workerIdentity?.documentNumber ?? selectedWorker?.documentNumber ?? "";
    return documentNumber ? formatRut(documentNumber) : "";
  }, [selectedWorker?.documentNumber, workerIdentity?.documentNumber]);
  const workerJobTitleValue = workerIdentity?.jobTitle ?? selectedWorker?.jobTitle ?? "";

  useEffect(() => {
    if (areaOptions.length === 0) {
      setSelectedAreaValue("");
      return;
    }

    setSelectedAreaValue((current) =>
      current && areaOptions.some((option) => option.value === current)
        ? current
        : areaOptions[0].value
    );
  }, [areaOptions]);

  useEffect(() => {
    if (!selectedIncentiveType?.requiresReplacement) {
      setReplacementWorker(null);
    }
  }, [selectedIncentiveType?.requiresReplacement]);

  useEffect(() => {
    if (!selectedIncentiveTypeId) {
      return;
    }

    if (incentiveTypes.some((item) => item.id === selectedIncentiveTypeId)) {
      return;
    }

    setSelectedIncentiveTypeId("");
  }, [incentiveTypes, selectedIncentiveTypeId]);

  useEffect(() => {
    if (!selectedIncentiveType?.allowsManualAmount) {
      setManualAmount("");
    }
  }, [selectedIncentiveType?.allowsManualAmount]);

  const selectedArea = useMemo(() => {
    const source = workerContextQuery.data?.availableAreas ?? [];
    return (
      source.find(
        (item) =>
          buildAreaOptionValue(item.contractCode, item.areaCode, item.areaName) ===
          selectedAreaValue
      ) ?? null
    );
  }, [selectedAreaValue, workerContextQuery.data?.availableAreas]);

  const durationHoursNumber =
    selectedIncentiveType?.calculationBasis === "per_hour" && durationHours.trim()
      ? Number(durationHours)
      : null;
  const hasManualAmountInput = manualAmount.trim() !== "";
  const manualAmountNumber = hasManualAmountInput ? Number(manualAmount) : null;
  const manualAmountIsValid =
    !hasManualAmountInput ||
    (typeof manualAmountNumber === "number" &&
      Number.isFinite(manualAmountNumber) &&
      manualAmountNumber >= 0);

  const rosterStatusAppearance = useMemo(
    () => resolveRosterStatusAppearance(rosterSnapshotQuery.data ?? null),
    [rosterSnapshotQuery.data]
  );
  const replacementRosterStatusAppearance = useMemo(
    () => resolveRosterStatusAppearance(replacementRosterSnapshotQuery.data ?? null),
    [replacementRosterSnapshotQuery.data]
  );
  const replacementWorkerValidationError = useMemo(() => {
    if (!selectedIncentiveType?.requiresReplacement || !replacementRosterSnapshotQuery.data) {
      return null;
    }

    if (isReplacementWorkerEligible(replacementRosterSnapshotQuery.data)) {
      return null;
    }

    return `El trabajador reemplazado debe estar en turno en la fecha seleccionada. El sistema detecta ${replacementRosterSnapshotQuery.data.scheduleLabel ?? "un estado no operativo"}.`;
  }, [replacementRosterSnapshotQuery.data, selectedIncentiveType?.requiresReplacement]);

  const registrationWindow = useMemo(
    () => resolveIncentiveRegistrationWindow(serviceDate),
    [serviceDate]
  );

  const selectedContractMismatch = useMemo(
    () =>
      resolveIncentiveContractMismatch(
        workerContextQuery.data?.worker.primaryContractCode,
        selectedArea?.contractCode
      ),
    [selectedArea?.contractCode, workerContextQuery.data?.worker.primaryContractCode]
  );

  const shouldShowPreview =
    Boolean(selectedWorker) &&
    Boolean(selectedIncentiveTypeId) &&
    Boolean(selectedArea?.contractCode) &&
    Boolean(serviceDate);

  const previewQuery = useHrIncentivePreview({
    bukEmployeeId: selectedWorker?.bukEmployeeId ?? "",
    incentiveTypeId: selectedIncentiveTypeId,
    selectedContractCode: selectedArea?.contractCode ?? "",
    durationHours: durationHoursNumber,
    manualAmount: manualAmountNumber,
    serviceDate,
    enabled:
      Boolean(selectedWorker) &&
      Boolean(selectedIncentiveTypeId) &&
      Boolean(selectedArea?.contractCode) &&
      Boolean(serviceDate) &&
      manualAmountIsValid &&
      (selectedIncentiveType?.calculationBasis !== "per_hour" ||
        (typeof durationHoursNumber === "number" && durationHoursNumber > 0))
  });

  const createRequestMutation = useMutation({
    mutationFn: createHrIncentiveRequest,
    onSuccess: async (result) => {
      setFormError("");
      setFormMessage(
        `Incentivo ${result.folio} registrado correctamente por ${formatCurrencyValue(
          result.calculatedAmount
        )} en período ${result.periodCode}.`
      );
      setSelectedWorker(null);
      setSelectedAreaValue("");
      setSelectedIncentiveTypeId("");
      setServiceDate(toTodayDateValue());
      setDurationHours("");
      setManualAmount("");
      setMotive("");
      setReplacementWorker(null);
      await invalidateHrIncentiveQueries(queryClient);
    },
    onError: (error: Error) => {
      setFormMessage("");
      setFormError(error.message);
    }
  });

  const isSubmitDisabled =
    !selectedWorker ||
    workerContextQuery.isLoading ||
    workerContextQuery.isError ||
    !workerContextQuery.data ||
    !selectedIncentiveTypeId ||
    !selectedArea ||
    !serviceDate ||
    rosterSnapshotQuery.isLoading ||
    !rosterSnapshotQuery.data ||
    previewQuery.isLoading ||
    !previewQuery.data ||
    previewQuery.data.rosterValidation.blockedByAbsence ||
    previewQuery.data.rosterValidation.blockedByExistingRestDayIncentive ||
    (previewQuery.data?.rosterValidation.requiresRestDay &&
      !previewQuery.data.rosterValidation.isRestDay) ||
    !registrationWindow.isAllowed ||
    (selectedIncentiveType?.calculationBasis === "per_hour" &&
      !(typeof durationHoursNumber === "number" && durationHoursNumber > 0)) ||
    (selectedIncentiveType?.allowsManualAmount && !manualAmountIsValid) ||
    (selectedIncentiveType?.requiresReplacement &&
      (!replacementWorker ||
        replacementRosterSnapshotQuery.isLoading ||
        !replacementRosterSnapshotQuery.data ||
        !isReplacementWorkerEligible(replacementRosterSnapshotQuery.data))) ||
    createRequestMutation.isPending;

  return (
    <section className="hr-incentives-layout">
      <section className="info-card">
        <div className="tracking-toolbar">
          <div className="tracking-toolbar-copy">
            <h3>Registrar incentivo</h3>
          </div>
        </div>

        {(setupCatalogsQuery.data?.incentiveTypes ?? []).filter((item) => item.isActive).length === 0 ? (
          <p className="form-status form-status-error">
            No hay tipos de incentivo activos. Configúralos primero en la pestaña
            &quot;Configuración base&quot;.
          </p>
        ) : null}

        {(setupCatalogsQuery.data?.allowedJobTitles ?? []).filter((item) => item.isActive).length === 0 ? (
          <p className="form-status form-status-error">
            No hay cargos BUK elegibles activos. Agrégalos primero en la configuración base.
          </p>
        ) : null}

        <div className="hr-incentives-form-grid">
          <IncentiveWorkerLookup
            id="incentive-worker"
            label="Trabajador"
            placeholder="Busca por nombre, RUT, contrato o cargo BUK. Solo aparecerán cargos elegibles."
            selectedWorker={selectedWorker}
            onSelect={(worker) => {
              setFormError("");
              setFormMessage("");
              setSelectedWorker(worker);
              setReplacementWorker(null);
            }}
          />

          <TextField
            id="incentive-worker-rut"
            label="RUT"
            value={workerRutValue}
            readOnly
          />

          <TextField
            id="incentive-worker-role"
            label="Cargo BUK"
            value={workerJobTitleValue}
            readOnly
          />

          <TextField
            id="incentive-worker-union-status"
            label="Sindicato BUK"
            value={
              workerContextQuery.data?.worker.unionName ??
              workerContextQuery.data?.worker.unionStatusLabel ??
              ""
            }
            readOnly
          />

          <SelectField
            id="incentive-worker-area"
            label="Área / contrato"
            value={selectedAreaValue}
            onChange={(event) => setSelectedAreaValue(event.target.value)}
            options={areaOptions}
            disabled={workerContextQuery.isLoading || workerContextQuery.isError || areaOptions.length === 0}
            placeholder={
              workerContextQuery.isLoading
                ? "Cargando contratos..."
                : workerContextQuery.isError
                  ? "No fue posible cargar el contrato operativo"
                  : "Selecciona el contrato aplicable"
            }
          />

          {selectedWorker && workerContextQuery.isError ? (
            <div className="hr-incentives-grid-span-2">
              <p className="form-status form-status-error">
                {workerContextQuery.error.message}
              </p>
            </div>
          ) : null}

          <SelectField
            id="incentive-type"
            label="Tipo de incentivo"
            value={selectedIncentiveTypeId}
            onChange={(event) => setSelectedIncentiveTypeId(event.target.value)}
            options={incentiveTypes.map((type) => ({
              value: type.id,
              label: type.name
            }))}
            disabled={
              setupCatalogsQuery.isLoading ||
              !selectedWorker ||
              !selectedArea?.contractCode ||
              !serviceDate ||
              eligibleIncentiveTypesQuery.isLoading
            }
            placeholder={
              !selectedWorker || !selectedArea?.contractCode || !serviceDate
                ? "Selecciona trabajador, contrato y fecha"
                : eligibleIncentiveTypesQuery.isLoading
                  ? "Cargando incentivos disponibles..."
                  : incentiveTypes.length === 0
                    ? "No hay incentivos con regla activa"
                    : "Selecciona el incentivo"
            }
          />

          {selectedWorker &&
          selectedArea?.contractCode &&
          serviceDate &&
          eligibleIncentiveTypesQuery.isError ? (
            <div className="hr-incentives-grid-span-2">
              <p className="form-status form-status-error">
                {eligibleIncentiveTypesQuery.error.message}
              </p>
            </div>
          ) : null}

          {selectedWorker &&
          selectedArea?.contractCode &&
          serviceDate &&
          !eligibleIncentiveTypesQuery.isLoading &&
          !eligibleIncentiveTypesQuery.isError &&
          incentiveTypes.length === 0 ? (
            <div className="hr-incentives-grid-span-2">
              <p className="form-status form-status-error">
                No existen tipos de incentivo con regla activa para este trabajador, contrato y fecha.
              </p>
            </div>
          ) : null}

          <DatePickerField
            id="incentive-service-date"
            label="Fecha de servicio"
            value={serviceDate}
            onChange={setServiceDate}
            minValue={registrationWindow.minimumDateValue}
            maxValue={registrationWindow.maximumDateValue}
          />

          {selectedIncentiveType?.allowsManualAmount ? (
            <TextField
              id="incentive-manual-amount"
              label="Monto manual (opcional)"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={manualAmount}
              onChange={(event) => setManualAmount(event.target.value)}
              placeholder="Si lo dejas vacío, se usará la regla activa"
              hasError={hasManualAmountInput && !manualAmountIsValid}
            />
          ) : null}

          <div className="hr-incentives-grid-span-2 hr-incentives-preview-card">
            <div className="hr-incentives-preview-header">
              <strong>
                {selectedIncentiveType?.allowsManualAmount ? "Monto final de la solicitud" : "Monto resuelto por regla"}
              </strong>
              <span className="tracking-filter-caption">
                {selectedIncentiveType?.allowsManualAmount
                  ? "Puedes ingresar un monto manual para esta solicitud. Si no lo haces, el sistema usará la regla vigente si existe."
                  : "La solicitud se registrará con esta misma resolución."}
              </span>
            </div>

            {selectedWorker && rosterSnapshotQuery.isLoading ? (
              <p className="tracking-filter-caption">Verificando estado operativo del trabajador...</p>
            ) : null}

            {selectedWorker && rosterSnapshotQuery.isError ? (
              <p className="form-status form-status-error">{rosterSnapshotQuery.error.message}</p>
            ) : null}

            {rosterStatusAppearance ? (
              <div
                className={`hr-incentives-roster-status hr-incentives-roster-status-${rosterStatusAppearance.tone}`}
              >
                <span className="hr-incentives-roster-status-label">Estado operativo detectado</span>
                <strong>{rosterStatusAppearance.title}</strong>
                <p>{rosterStatusAppearance.description}</p>
              </div>
            ) : null}

            {!shouldShowPreview ? (
              <p className="tracking-filter-caption">
                Selecciona trabajador, contrato, tipo de incentivo y fecha para calcular el monto.
              </p>
            ) : null}

            {shouldShowPreview && previewQuery.isLoading ? (
              <p className="tracking-filter-caption">Calculando monto según reglas activas...</p>
            ) : null}

            {shouldShowPreview && previewQuery.isError ? (
              <IncentiveRuleAlert>{previewQuery.error.message}</IncentiveRuleAlert>
            ) : null}

            {previewQuery.data ? (
              <>
                <IncentiveOperationalFlags
                  periodCode={registrationWindow.periodCode}
                  entryLagDays={registrationWindow.entryLagDays}
                  isOutOfDeadline={registrationWindow.isOutOfDeadline}
                  isContractMismatch={selectedContractMismatch}
                />
                <div className="hr-incentives-preview-body">
                  <div>
                    <span>Monto calculado</span>
                    <strong>{formatCurrencyValue(previewQuery.data.calculatedAmount)}</strong>
                  </div>
                  <div>
                    <span>Origen del monto</span>
                    <strong>{previewQuery.data.amountSource === "manual" ? "Manual" : "Regla"}</strong>
                  </div>
                  <div>
                    <span>Regla base</span>
                    <strong>
                      {previewQuery.data.rule.rateRuleId
                        ? formatCurrencyValue(previewQuery.data.rule.rateRuleAmount)
                        : "Sin regla requerida"}
                    </strong>
                  </div>
                  {previewQuery.data.manualAmount !== null ? (
                    <div>
                      <span>Monto ingresado</span>
                      <strong>{formatCurrencyValue(previewQuery.data.manualAmount)}</strong>
                    </div>
                  ) : null}
                  <div>
                    <span>Contrato aplicado</span>
                    <strong>
                      {previewQuery.data.rule.rateRuleId
                        ? previewQuery.data.rule.matchedContractCode ?? "Todos"
                        : "No aplica"}
                    </strong>
                  </div>
                  <div>
                    <span>Cargo aplicado</span>
                    <strong>
                      {previewQuery.data.rule.rateRuleId
                        ? previewQuery.data.rule.matchedJobTitle ?? "Todos"
                        : "No aplica"}
                    </strong>
                  </div>
                  <div>
                    <span>Sindicato aplicado</span>
                    <strong>
                      {previewQuery.data.rule.rateRuleId
                        ? previewQuery.data.rule.matchedUnionName ?? "Cualquiera"
                        : "No aplica"}
                    </strong>
                  </div>
                  <div>
                    <span>Prioridad</span>
                    <strong>{previewQuery.data.rule.rateRuleId ? previewQuery.data.rule.priority : "No aplica"}</strong>
                  </div>
                </div>
                {previewQuery.data.amountSource === "rule" ? (
                  (() => {
                    const hourlyRateBreakdown = buildHourlyRateBreakdownCopy({
                      hourRateStrategy: previewQuery.data.rule.hourRateStrategy,
                      rateSource: previewQuery.data.rateSource,
                      rateRuleAmount: previewQuery.data.rule.rateRuleAmount,
                      rateBaseSalary: previewQuery.data.rateBaseSalary,
                      rateWeeklyHours: previewQuery.data.rateWeeklyHours,
                      rateOvertimeMultiplier: previewQuery.data.rateOvertimeMultiplier
                    });

                    return hourlyRateBreakdown ? (
                      <p className="tracking-filter-caption">{hourlyRateBreakdown}</p>
                    ) : null;
                  })()
                ) : null}
                {previewQuery.data.rosterValidation.blockedByAbsence ? (
                  <IncentiveRuleAlert>
                    {previewQuery.data.rosterValidation.blockReason ??
                      "No se puede registrar este incentivo porque el trabajador figura con vacaciones o licencia médica en la fecha seleccionada."}
                  </IncentiveRuleAlert>
                ) : null}
                {previewQuery.data.rosterValidation.blockedByExistingRestDayIncentive ? (
                  <IncentiveRuleAlert>
                    {previewQuery.data.rosterValidation.blockReason ??
                      `No se puede registrar otro incentivo el ${formatDateForDisplay(serviceDate)} porque el trabajador ya registra un incentivo con descanso activo para esa fecha.`}
                  </IncentiveRuleAlert>
                ) : null}
                {previewQuery.data.rosterValidation.requiresRestDay &&
                !previewQuery.data.rosterValidation.blockedByAbsence &&
                !previewQuery.data.rosterValidation.blockedByExistingRestDayIncentive ? (
                  previewQuery.data.rosterValidation.isRestDay ? (
                    <p className="form-status form-status-success">
                      {`Validación de descanso OK: ${previewQuery.data.rosterValidation.scheduleLabel ?? "Descanso"}.`}
                    </p>
                  ) : (
                    <IncentiveRuleAlert>
                      {`No puedes usar a este trabajador como reemplazo el ${formatDateForDisplay(serviceDate)} porque su pauta lo marca ${previewQuery.data.rosterValidation.scheduleLabel?.toLowerCase() ?? "en turno"}. Este incentivo solo se permite cuando el trabajador está en descanso.`}
                    </IncentiveRuleAlert>
                  )
                ) : null}
              </>
            ) : null}

            {!registrationWindow.isAllowed ? (
              <IncentiveRuleAlert>
                Solo se permite registrar incentivos hasta 7 días hacia atrás desde hoy.
              </IncentiveRuleAlert>
            ) : null}
          </div>

          {selectedIncentiveType?.calculationBasis === "per_hour" ? (
            <TextField
              id="incentive-duration-hours"
              label="Horas a compensar"
              type="number"
              min="0"
              step="0.5"
              inputMode="decimal"
              value={durationHours}
              onChange={(event) => setDurationHours(event.target.value)}
              hasError={Boolean(durationHours) && Number(durationHours) <= 0}
            />
          ) : null}

          {selectedIncentiveType?.requiresReplacement ? (
            <div className="hr-incentives-grid-span-2">
              <IncentiveWorkerLookup
                id="incentive-replacement-worker"
                label="Trabajador reemplazado"
                placeholder="Busca al trabajador reemplazado"
                selectedWorker={replacementWorker}
                onSelect={(worker) => {
                  setFormError("");
                  setFormMessage("");
                  setReplacementWorker(worker);
                }}
                excludeBukEmployeeId={selectedWorker?.bukEmployeeId ?? null}
              />
              {replacementWorker && replacementRosterSnapshotQuery.isLoading ? (
                <p className="tracking-filter-caption">
                  Verificando estado operativo del trabajador reemplazado...
                </p>
              ) : null}
              {replacementWorker && replacementRosterSnapshotQuery.isError ? (
                <p className="form-status form-status-error">
                  {replacementRosterSnapshotQuery.error.message}
                </p>
              ) : null}
              {replacementRosterStatusAppearance ? (
                <div
                  className={`hr-incentives-roster-status hr-incentives-roster-status-${replacementRosterStatusAppearance.tone}`}
                >
                  <span className="hr-incentives-roster-status-label">
                    Estado del trabajador reemplazado
                  </span>
                  <strong>{replacementRosterStatusAppearance.title}</strong>
                  <p>
                    {isReplacementWorkerEligible(replacementRosterSnapshotQuery.data ?? null)
                      ? "La pauta detectada permite usarlo como trabajador reemplazado."
                      : "Solo se permite registrar el incentivo si el trabajador reemplazado figura en turno para esa fecha."}
                  </p>
                </div>
              ) : null}
              {replacementWorkerValidationError ? (
                <IncentiveRuleAlert>{replacementWorkerValidationError}</IncentiveRuleAlert>
              ) : null}
            </div>
          ) : null}

          <div className="field-group hr-incentives-grid-span-2">
            <label className="field-label" htmlFor="incentive-motive">
              Motivo operacional
            </label>
            <textarea
              id="incentive-motive"
              className="text-field hr-incentives-textarea"
              value={motive}
              placeholder="Describe el motivo del incentivo."
              onChange={(event) => setMotive(event.target.value)}
            />
          </div>
        </div>

        {formError ? <p className="form-status form-status-error">{formError}</p> : null}
        {formMessage ? <p className="form-status">{formMessage}</p> : null}

        <div className="action-row hr-incentives-action-row">
          <button
            type="button"
            className="soft-primary-button soft-primary-button-neutral"
            onClick={() => {
              setSelectedWorker(null);
              setSelectedAreaValue("");
              setSelectedIncentiveTypeId("");
              setServiceDate(toTodayDateValue());
              setDurationHours("");
              setManualAmount("");
              setMotive("");
              setReplacementWorker(null);
              setFormError("");
              setFormMessage("");
            }}
            disabled={createRequestMutation.isPending}
          >
            Limpiar formulario
          </button>
          <button
            type="button"
            className="soft-primary-button soft-primary-button-success"
            disabled={isSubmitDisabled}
            onClick={() => {
              const rosterSnapshot = rosterSnapshotQuery.data;

              if (!selectedWorker || !selectedArea || !rosterSnapshot) {
                return;
              }

              setFormError("");
              setFormMessage("");

              createRequestMutation.mutate({
                bukEmployeeId: selectedWorker.bukEmployeeId,
                incentiveTypeId: selectedIncentiveTypeId,
                selectedContractCode: selectedArea.contractCode ?? "",
                selectedAreaName: selectedArea.areaName ?? "",
                selectedAreaCode: selectedArea.areaCode,
                serviceDate: `${serviceDate}T12:00:00-04:00`,
                durationHours: durationHoursNumber,
                manualAmount: manualAmountNumber,
                motive,
                description: null,
                replacementBukEmployeeId: replacementWorker?.bukEmployeeId ?? null,
                declaredRestDay: rosterSnapshot.isRestDay
              });
            }}
          >
            Registrar incentivo
          </button>
        </div>
      </section>

    </section>
  );
}
