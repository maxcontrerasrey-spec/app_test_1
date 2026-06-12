import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { DatePickerField, SelectField, TextField } from "../../../shared/ui";
import { formatCurrencyValue } from "../../../shared/lib/format";
import { formatRut } from "../../../shared/lib/rut";
import { toTodayDateValue } from "../../../shared/lib/date";
import {
  createHrIncentiveRequest
} from "../services/incentivesApi";
import {
  invalidateHrIncentiveQueries,
  useHrIncentivePreview,
  useHrIncentiveWorkerContext
} from "../hooks/useIncentivesQueries";
import type {
  HrIncentiveEligibleWorker,
  HrIncentiveSetupCatalogs
} from "../types";
import { IncentiveWorkerLookup } from "./IncentiveWorkerLookup";

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

export function IncentiveRegistrationForm({
  setupCatalogsQuery
}: IncentiveRegistrationFormProps) {
  const queryClient = useQueryClient();
  const [selectedWorker, setSelectedWorker] = useState<HrIncentiveEligibleWorker | null>(null);
  const [selectedAreaValue, setSelectedAreaValue] = useState("");
  const [selectedIncentiveTypeId, setSelectedIncentiveTypeId] = useState("");
  const [serviceDate, setServiceDate] = useState(toTodayDateValue());
  const [durationHours, setDurationHours] = useState("");
  const [motive, setMotive] = useState("");
  const [description, setDescription] = useState("");
  const [replacementWorker, setReplacementWorker] = useState<HrIncentiveEligibleWorker | null>(null);
  const [formMessage, setFormMessage] = useState("");
  const [formError, setFormError] = useState("");

  const workerContextQuery = useHrIncentiveWorkerContext(
    selectedWorker?.bukEmployeeId ?? "",
    Boolean(selectedWorker)
  );

  const incentiveTypes = useMemo(
    () => (setupCatalogsQuery.data?.incentiveTypes ?? []).filter((item) => item.isActive),
    [setupCatalogsQuery.data?.incentiveTypes]
  );

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
    serviceDate,
    enabled:
      Boolean(selectedWorker) &&
      Boolean(selectedIncentiveTypeId) &&
      Boolean(selectedArea?.contractCode) &&
      Boolean(serviceDate) &&
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
        )}.`
      );
      setSelectedWorker(null);
      setSelectedAreaValue("");
      setSelectedIncentiveTypeId("");
      setServiceDate(toTodayDateValue());
      setDurationHours("");
      setMotive("");
      setDescription("");
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
    !selectedIncentiveTypeId ||
    !selectedArea ||
    !serviceDate ||
    previewQuery.isLoading ||
    !previewQuery.data ||
    (selectedIncentiveType?.calculationBasis === "per_hour" &&
      !(typeof durationHoursNumber === "number" && durationHoursNumber > 0)) ||
    (selectedIncentiveType?.requiresReplacement && !replacementWorker) ||
    createRequestMutation.isPending;

  return (
    <section className="hr-incentives-layout">
      <section className="info-card">
        <div className="tracking-toolbar">
          <div className="tracking-toolbar-copy">
            <h3>Registrar incentivo</h3>
            <span className="tracking-filter-caption">
              La app calcula el monto automáticamente desde las reglas activas.
            </span>
          </div>
        </div>

        {incentiveTypes.length === 0 ? (
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
            placeholder="Busca trabajador por nombre, RUT o contrato"
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
            value={
              workerContextQuery.data?.worker.documentNumber
                ? formatRut(workerContextQuery.data.worker.documentNumber)
                : ""
            }
            readOnly
          />

          <TextField
            id="incentive-worker-role"
            label="Cargo BUK"
            value={workerContextQuery.data?.worker.jobTitle ?? ""}
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
            disabled={areaOptions.length === 0}
            placeholder={
              workerContextQuery.isLoading
                ? "Cargando contratos..."
                : "Selecciona el contrato aplicable"
            }
          />

          <SelectField
            id="incentive-type"
            label="Tipo de incentivo"
            value={selectedIncentiveTypeId}
            onChange={(event) => setSelectedIncentiveTypeId(event.target.value)}
            options={incentiveTypes.map((type) => ({
              value: type.id,
              label: type.name
            }))}
            disabled={setupCatalogsQuery.isLoading}
            placeholder="Selecciona el incentivo"
          />

          <DatePickerField
            id="incentive-service-date"
            label="Fecha de servicio"
            value={serviceDate}
            onChange={setServiceDate}
          />

          <div className="hr-incentives-grid-span-2 hr-incentives-preview-card">
            <div className="hr-incentives-preview-header">
              <strong>Monto resuelto por regla</strong>
              <span className="tracking-filter-caption">
                La solicitud se registrará con esta misma resolución.
              </span>
            </div>

            {!shouldShowPreview ? (
              <p className="tracking-filter-caption">
                Selecciona trabajador, contrato, tipo de incentivo y fecha para calcular el monto.
              </p>
            ) : null}

            {shouldShowPreview && previewQuery.isLoading ? (
              <p className="tracking-filter-caption">Calculando monto según reglas activas...</p>
            ) : null}

            {shouldShowPreview && previewQuery.isError ? (
              <p className="form-status form-status-error">
                {previewQuery.error.message}
              </p>
            ) : null}

            {previewQuery.data ? (
              <div className="hr-incentives-preview-body">
                <div>
                  <span>Monto calculado</span>
                  <strong>{formatCurrencyValue(previewQuery.data.calculatedAmount)}</strong>
                </div>
                <div>
                  <span>Regla base</span>
                  <strong>{formatCurrencyValue(previewQuery.data.rule.rateRuleAmount)}</strong>
                </div>
                <div>
                  <span>Contrato aplicado</span>
                  <strong>
                    {previewQuery.data.rule.matchedContractCode ?? "Todos"}
                  </strong>
                </div>
                <div>
                  <span>Cargo aplicado</span>
                  <strong>{previewQuery.data.rule.matchedJobTitle ?? "Todos"}</strong>
                </div>
                <div>
                  <span>Sindicato aplicado</span>
                  <strong>{previewQuery.data.rule.matchedUnionName ?? "Cualquiera"}</strong>
                </div>
                <div>
                  <span>Prioridad</span>
                  <strong>{previewQuery.data.rule.priority}</strong>
                </div>
              </div>
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
          ) : (
            <TextField
              id="incentive-duration-placeholder"
              label="Base de cálculo"
              value={selectedIncentiveType ? "Monto fijo por regla activa" : ""}
              readOnly
            />
          )}

          {selectedIncentiveType?.requiresReplacement ? (
            <div className="hr-incentives-grid-span-2">
              <IncentiveWorkerLookup
                id="incentive-replacement-worker"
                label="Trabajador reemplazado"
                placeholder="Busca al trabajador reemplazado"
                selectedWorker={replacementWorker}
                onSelect={setReplacementWorker}
                excludeBukEmployeeId={selectedWorker?.bukEmployeeId ?? null}
              />
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

          <div className="field-group hr-incentives-grid-span-2">
            <label className="field-label" htmlFor="incentive-description">
              Observaciones complementarias
            </label>
            <textarea
              id="incentive-description"
              className="text-field hr-incentives-textarea"
              value={description}
              placeholder="Agrega contexto adicional si corresponde."
              onChange={(event) => setDescription(event.target.value)}
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
              setMotive("");
              setDescription("");
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
              if (!selectedWorker || !selectedArea) {
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
                motive,
                description,
                replacementBukEmployeeId: replacementWorker?.bukEmployeeId ?? null
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
