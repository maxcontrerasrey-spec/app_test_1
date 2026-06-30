import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { SelectField, TextField } from "../../../shared/ui";
import { formatNumberValue } from "../../../shared/lib/format";
import { queryKeys } from "../../../shared/lib/queryKeys";
import {
  addHrIncentiveAllowedJobTitle,
  addHrIncentiveRateRule,
  addHrIncentiveType,
  setHrIncentiveAllowedJobTitleStatus,
  setHrIncentiveRateRuleStatus,
  setHrIncentiveTypeHourRateStrategy,
  setHrIncentiveTypeManualAmountOption,
  setHrIncentiveTypeRosterRequirement,
  setHrIncentiveTypeStatus
} from "../services/incentivesApi";
import type { HrIncentiveSetupCatalogs } from "../types";

type IncentiveSetupViewProps = {
  setupCatalogsQuery: UseQueryResult<HrIncentiveSetupCatalogs, Error>;
};

export function IncentiveSetupView({ setupCatalogsQuery }: IncentiveSetupViewProps) {
  const queryClient = useQueryClient();
  const [jobTitleStatusFilter, setJobTitleStatusFilter] = useState<"all" | "active" | "inactive">(
    "all"
  );
  const [typeStatusFilter, setTypeStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [ruleStatusFilter, setRuleStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [jobTitleDraft, setJobTitleDraft] = useState("");
  const [typeCodeDraft, setTypeCodeDraft] = useState("");
  const [typeNameDraft, setTypeNameDraft] = useState("");
  const [typeBasisDraft, setTypeBasisDraft] = useState<"fixed" | "per_hour">("fixed");
  const [typeHourRateStrategyDraft, setTypeHourRateStrategyDraft] = useState<
    "rule_amount" | "buk_overtime"
  >("rule_amount");
  const [typeRequiresReplacementDraft, setTypeRequiresReplacementDraft] = useState("false");
  const [typeAllowsManualAmountDraft, setTypeAllowsManualAmountDraft] = useState("false");
  const [ruleTypeIdDraft, setRuleTypeIdDraft] = useState("");
  const [ruleAmountDraft, setRuleAmountDraft] = useState("");
  const [ruleFallbackBaseSalaryDraft, setRuleFallbackBaseSalaryDraft] = useState("");
  const [ruleFallbackWeeklyHoursDraft, setRuleFallbackWeeklyHoursDraft] = useState("");
  const [ruleOvertimeMultiplierDraft, setRuleOvertimeMultiplierDraft] = useState("1.5");
  const [ruleContractCodeDraft, setRuleContractCodeDraft] = useState("");
  const [ruleJobTitleDraft, setRuleJobTitleDraft] = useState("");
  const [ruleUnionNameDraft, setRuleUnionNameDraft] = useState("");
  const [rulePriorityDraft, setRulePriorityDraft] = useState("100");
  const [ruleValidFromDraft, setRuleValidFromDraft] = useState("");
  const [ruleValidToDraft, setRuleValidToDraft] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const bukJobTitleOptions = useMemo(
    () =>
      (setupCatalogsQuery.data?.bukJobTitles ?? []).map((jobTitle) => ({
        value: jobTitle,
        label: jobTitle
      })),
    [setupCatalogsQuery.data?.bukJobTitles]
  );
  const bukUnionOptions = useMemo(
    () =>
      (setupCatalogsQuery.data?.bukUnions ?? []).map((item) => ({
        value: item.value,
        label: item.label
      })),
    [setupCatalogsQuery.data?.bukUnions]
  );
  const contractOptions = useMemo(
    () => setupCatalogsQuery.data?.contractOptions ?? [],
    [setupCatalogsQuery.data?.contractOptions]
  );
  const typeCodeById = useMemo(
    () =>
      new Map((setupCatalogsQuery.data?.incentiveTypes ?? []).map((item) => [item.id, item.code])),
    [setupCatalogsQuery.data?.incentiveTypes]
  );
  const typeById = useMemo(
    () =>
      new Map((setupCatalogsQuery.data?.incentiveTypes ?? []).map((item) => [item.id, item])),
    [setupCatalogsQuery.data?.incentiveTypes]
  );
  const selectedRuleType = ruleTypeIdDraft ? typeById.get(ruleTypeIdDraft) ?? null : null;
  const ruleUsesBukOvertime = selectedRuleType?.hourRateStrategy === "buk_overtime";
  const filteredAllowedJobTitles = useMemo(() => {
    const source = setupCatalogsQuery.data?.allowedJobTitles ?? [];
    if (jobTitleStatusFilter === "all") {
      return source;
    }

    return source.filter((item) =>
      jobTitleStatusFilter === "active" ? item.isActive : !item.isActive
    );
  }, [jobTitleStatusFilter, setupCatalogsQuery.data?.allowedJobTitles]);
  const filteredIncentiveTypes = useMemo(() => {
    const source = setupCatalogsQuery.data?.incentiveTypes ?? [];
    if (typeStatusFilter === "all") {
      return source;
    }

    return source.filter((item) => (typeStatusFilter === "active" ? item.isActive : !item.isActive));
  }, [setupCatalogsQuery.data?.incentiveTypes, typeStatusFilter]);
  const filteredRateRules = useMemo(() => {
    const source = setupCatalogsQuery.data?.rateRules ?? [];
    if (ruleStatusFilter === "all") {
      return source;
    }

    return source.filter((item) => (ruleStatusFilter === "active" ? item.isActive : !item.isActive));
  }, [ruleStatusFilter, setupCatalogsQuery.data?.rateRules]);

  const refreshSetupCatalogs = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.incentives.setupCatalogs() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.incentives.eligibleTypesRoot() })
    ]);

  const jobTitleMutation = useMutation({
    mutationFn: addHrIncentiveAllowedJobTitle,
    onSuccess: async () => {
      setJobTitleDraft("");
      setErrorMessage("");
      setStatusMessage("Cargo elegible actualizado.");
      await refreshSetupCatalogs();
    },
    onError: (error: Error) => {
      setStatusMessage("");
      setErrorMessage(error.message);
    }
  });

  const incentiveTypeMutation = useMutation({
    mutationFn: addHrIncentiveType,
    onSuccess: async () => {
      setTypeCodeDraft("");
      setTypeNameDraft("");
      setTypeBasisDraft("fixed");
      setTypeHourRateStrategyDraft("rule_amount");
      setTypeRequiresReplacementDraft("false");
      setTypeAllowsManualAmountDraft("false");
      setErrorMessage("");
      setStatusMessage("Tipo de incentivo actualizado.");
      await refreshSetupCatalogs();
    },
    onError: (error: Error) => {
      setStatusMessage("");
      setErrorMessage(error.message);
    }
  });

  const rateRuleMutation = useMutation({
    mutationFn: addHrIncentiveRateRule,
    onSuccess: async () => {
      setRuleAmountDraft("");
      setRuleFallbackBaseSalaryDraft("");
      setRuleFallbackWeeklyHoursDraft("");
      setRuleOvertimeMultiplierDraft("1.5");
      setRuleContractCodeDraft("");
      setRuleJobTitleDraft("");
      setRuleUnionNameDraft("");
      setRulePriorityDraft("100");
      setRuleValidFromDraft("");
      setRuleValidToDraft("");
      setErrorMessage("");
      setStatusMessage("Regla de monto actualizada.");
      await refreshSetupCatalogs();
    },
    onError: (error: Error) => {
      setStatusMessage("");
      setErrorMessage(error.message);
    }
  });

  const toggleJobTitleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      setHrIncentiveAllowedJobTitleStatus(id, isActive),
    onSuccess: refreshSetupCatalogs
  });

  const toggleTypeMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      setHrIncentiveTypeStatus(id, isActive),
    onSuccess: refreshSetupCatalogs
  });

  const toggleTypeRosterMutation = useMutation({
    mutationFn: ({ id, requiresRestDay }: { id: string; requiresRestDay: boolean }) =>
      setHrIncentiveTypeRosterRequirement(id, requiresRestDay),
    onSuccess: refreshSetupCatalogs
  });

  const toggleTypeManualAmountMutation = useMutation({
    mutationFn: ({ id, allowsManualAmount }: { id: string; allowsManualAmount: boolean }) =>
      setHrIncentiveTypeManualAmountOption(id, allowsManualAmount),
    onSuccess: refreshSetupCatalogs
  });

  const toggleTypeHourRateStrategyMutation = useMutation({
    mutationFn: ({
      id,
      hourRateStrategy
    }: {
      id: string;
      hourRateStrategy: "rule_amount" | "buk_overtime";
    }) => setHrIncentiveTypeHourRateStrategy(id, hourRateStrategy),
    onSuccess: refreshSetupCatalogs
  });

  const toggleRuleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      setHrIncentiveRateRuleStatus(id, isActive),
    onSuccess: refreshSetupCatalogs
  });

  useEffect(() => {
    if (typeBasisDraft !== "per_hour") {
      setTypeHourRateStrategyDraft("rule_amount");
    }
  }, [typeBasisDraft]);

  useEffect(() => {
    if (!ruleUsesBukOvertime) {
      setRuleFallbackBaseSalaryDraft("");
      setRuleFallbackWeeklyHoursDraft("");
      setRuleOvertimeMultiplierDraft("1.5");
    }
  }, [ruleUsesBukOvertime]);

  return (
    <section className="hr-incentives-setup-grid">
      <section className="info-card hr-incentives-setup-card hr-incentives-setup-card-compact">
        <div className="tracking-toolbar-copy">
          <h3>Cargos elegibles BUK</h3>
          <span className="tracking-filter-caption">
            Solo estos cargos aparecerán al buscar trabajadores para incentivos.
            {bukJobTitleOptions.length
              ? ` Catálogo activo BUK: ${bukJobTitleOptions.length} cargos detectados.`
              : " No hay cargos BUK disponibles aún en la sync activa."}
          </span>
        </div>

        <div className="hr-incentives-inline-form">
          <SelectField
            id="setup-job-title"
            label="Cargo BUK"
            value={jobTitleDraft}
            onChange={(event) => setJobTitleDraft(event.target.value)}
            options={bukJobTitleOptions}
            placeholder="Selecciona un cargo sincronizado desde BUK"
            disabled={jobTitleMutation.isPending || bukJobTitleOptions.length === 0}
          />
          <button
            type="button"
            className="soft-primary-button soft-primary-button-success hr-incentives-compact-btn"
            disabled={
              jobTitleMutation.isPending || !jobTitleDraft.trim() || bukJobTitleOptions.length === 0
            }
            onClick={() => jobTitleMutation.mutate(jobTitleDraft)}
          >
            Guardar cargo
          </button>
          <SelectField
            id="setup-job-title-status-filter"
            label="Ver"
            value={jobTitleStatusFilter}
            onChange={(event) =>
              setJobTitleStatusFilter(
                event.target.value === "active" || event.target.value === "inactive"
                  ? event.target.value
                  : "all"
              )
            }
            options={[
              { value: "all", label: "Todos" },
              { value: "active", label: "Solo activos" },
              { value: "inactive", label: "Solo inactivos" }
            ]}
          />
        </div>

        <div className="hr-incentives-list hr-incentives-list-compact">
          {filteredAllowedJobTitles.map((item) => (
            <div key={item.id} className="hr-incentives-list-item">
              <div>
                <strong>{item.jobTitle}</strong>
                <span>{item.isActive ? "Activo" : "Inactivo"}</span>
              </div>
              <button
                type="button"
                className="soft-primary-button hr-incentives-inline-button"
                disabled={toggleJobTitleMutation.isPending}
                onClick={() =>
                  toggleJobTitleMutation.mutate({
                    id: item.id,
                    isActive: !item.isActive
                  })
                }
              >
                {item.isActive ? "Desactivar" : "Activar"}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="info-card hr-incentives-setup-card">
        <div className="tracking-toolbar-copy">
          <h3>Tipos de incentivo</h3>
          <span className="tracking-filter-caption">
            Define base de cálculo y si requiere trabajador reemplazado.
          </span>
        </div>

        <div className="hr-incentives-form-grid hr-incentives-form-grid-compact">
          <TextField
            id="setup-type-code"
            label="Código"
            value={typeCodeDraft}
            onChange={(event) => setTypeCodeDraft(event.target.value)}
            placeholder="ejemplo_codigo"
          />
          <TextField
            id="setup-type-name"
            label="Nombre"
            value={typeNameDraft}
            onChange={(event) => setTypeNameDraft(event.target.value)}
            placeholder="Nombre visible"
          />
          <SelectField
            id="setup-type-basis"
            label="Base de cálculo"
            value={typeBasisDraft}
            onChange={(event) =>
              setTypeBasisDraft(event.target.value === "per_hour" ? "per_hour" : "fixed")
            }
            options={[
              { value: "fixed", label: "Monto fijo" },
              { value: "per_hour", label: "Por hora" }
            ]}
          />
          <SelectField
            id="setup-type-replacement"
            label="Exige reemplazo"
            value={typeRequiresReplacementDraft}
            onChange={(event) => setTypeRequiresReplacementDraft(event.target.value)}
            options={[
              { value: "false", label: "No" },
              { value: "true", label: "Sí" }
            ]}
          />
          <SelectField
            id="setup-type-manual-amount"
            label="Permite monto manual"
            value={typeAllowsManualAmountDraft}
            onChange={(event) => setTypeAllowsManualAmountDraft(event.target.value)}
            options={[
              { value: "false", label: "No" },
              { value: "true", label: "Sí" }
            ]}
          />
          <SelectField
            id="setup-type-hour-rate-strategy"
            label="Tarifa horaria"
            value={typeBasisDraft === "per_hour" ? typeHourRateStrategyDraft : "rule_amount"}
            onChange={(event) =>
              setTypeHourRateStrategyDraft(
                event.target.value === "buk_overtime" ? "buk_overtime" : "rule_amount"
              )
            }
            options={[
              { value: "rule_amount", label: "Regla directa" },
              { value: "buk_overtime", label: "Hora extra BUK" }
            ]}
            disabled={typeBasisDraft !== "per_hour"}
          />
        </div>

        <div className="action-row">
          <button
            type="button"
            className="soft-primary-button soft-primary-button-success hr-incentives-compact-btn"
            disabled={
              incentiveTypeMutation.isPending || !typeCodeDraft.trim() || !typeNameDraft.trim()
            }
            onClick={() =>
              incentiveTypeMutation.mutate({
                code: typeCodeDraft.trim().toLowerCase(),
                name: typeNameDraft.trim(),
                calculationBasis: typeBasisDraft,
                hourRateStrategy:
                  typeBasisDraft === "per_hour" ? typeHourRateStrategyDraft : "rule_amount",
                requiresReplacement: typeRequiresReplacementDraft === "true",
                allowsManualAmount: typeAllowsManualAmountDraft === "true"
              })
            }
          >
            Guardar tipo
          </button>
          <SelectField
            id="setup-type-status-filter"
            label="Ver"
            value={typeStatusFilter}
            onChange={(event) =>
              setTypeStatusFilter(
                event.target.value === "active" || event.target.value === "inactive"
                  ? event.target.value
                  : "all"
              )
            }
            options={[
              { value: "all", label: "Todos" },
              { value: "active", label: "Solo activos" },
              { value: "inactive", label: "Solo inactivos" }
            ]}
          />
        </div>

        <div className="hr-incentives-list">
          {filteredIncentiveTypes.map((item) => (
            <div key={item.id} className="hr-incentives-list-item">
              <div>
                <strong>{item.name}</strong>
                <span>
                  Código: {item.code} ·{" "}
                  {item.calculationBasis === "per_hour" ? "Por hora" : "Monto fijo"} ·{" "}
                  {item.calculationBasis === "per_hour"
                    ? item.hourRateStrategy === "buk_overtime"
                      ? "Hora extra BUK"
                      : "Tarifa por regla"
                    : "Tarifa directa"}{" "}
                  ·{" "}
                  {item.requiresReplacement ? "Con reemplazo" : "Sin reemplazo"} ·{" "}
                  {item.requiresRestDay ? "Exige descanso" : "Sin validación de descanso"} ·{" "}
                  {item.allowsManualAmount ? "Permite monto manual" : "Monto solo por regla"}
                </span>
              </div>
              <div className="hr-incentives-list-item-actions">
                {item.calculationBasis === "per_hour" ? (
                  <button
                    type="button"
                    className="soft-primary-button hr-incentives-inline-button"
                    disabled={toggleTypeHourRateStrategyMutation.isPending}
                    onClick={() =>
                      toggleTypeHourRateStrategyMutation.mutate({
                        id: item.id,
                        hourRateStrategy:
                          item.hourRateStrategy === "buk_overtime"
                            ? "rule_amount"
                            : "buk_overtime"
                      })
                    }
                  >
                    {item.hourRateStrategy === "buk_overtime"
                      ? "Usar regla horaria"
                      : "Usar hora extra BUK"}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="soft-primary-button hr-incentives-inline-button"
                  disabled={toggleTypeManualAmountMutation.isPending}
                  onClick={() =>
                    toggleTypeManualAmountMutation.mutate({
                      id: item.id,
                      allowsManualAmount: !item.allowsManualAmount
                    })
                  }
                >
                  {item.allowsManualAmount ? "Bloquear monto manual" : "Permitir monto manual"}
                </button>
                <button
                  type="button"
                  className="soft-primary-button hr-incentives-inline-button"
                  disabled={toggleTypeRosterMutation.isPending}
                  onClick={() =>
                    toggleTypeRosterMutation.mutate({
                      id: item.id,
                      requiresRestDay: !item.requiresRestDay
                    })
                  }
                >
                  {item.requiresRestDay ? "Quitar descanso" : "Exigir descanso"}
                </button>
                <button
                  type="button"
                  className="soft-primary-button hr-incentives-inline-button"
                  disabled={toggleTypeMutation.isPending}
                  onClick={() =>
                    toggleTypeMutation.mutate({
                      id: item.id,
                      isActive: !item.isActive
                    })
                  }
                >
                  {item.isActive ? "Desactivar" : "Activar"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="info-card hr-incentives-setup-rule-card">
        <div className="tracking-toolbar-copy">
          <h3>Reglas de monto</h3>
          <span className="tracking-filter-caption">
            El formulario usará automáticamente la regla más específica y vigente según contrato,
            cargo y sindicato BUK específico.
          </span>
        </div>

        <div className="hr-incentives-form-grid hr-incentives-form-grid-compact">
          <SelectField
            id="setup-rule-type"
            label="Tipo de incentivo"
            value={ruleTypeIdDraft}
            onChange={(event) => setRuleTypeIdDraft(event.target.value)}
            options={(setupCatalogsQuery.data?.incentiveTypes ?? []).map((item) => ({
              value: item.id,
              label: item.name
            }))}
          />
          <TextField
            id="setup-rule-amount"
            label={ruleUsesBukOvertime ? "Valor hora directo (opcional)" : "Monto"}
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            value={ruleAmountDraft}
            onChange={(event) => setRuleAmountDraft(event.target.value)}
          />
          {ruleUsesBukOvertime ? (
            <TextField
              id="setup-rule-fallback-base-salary"
              label="Sueldo base fallback (opcional)"
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={ruleFallbackBaseSalaryDraft}
              onChange={(event) => setRuleFallbackBaseSalaryDraft(event.target.value)}
            />
          ) : null}
          {ruleUsesBukOvertime ? (
            <TextField
              id="setup-rule-fallback-weekly-hours"
              label="Jornada semanal fallback (opcional)"
              type="number"
              min="1"
              step="0.5"
              inputMode="decimal"
              value={ruleFallbackWeeklyHoursDraft}
              onChange={(event) => setRuleFallbackWeeklyHoursDraft(event.target.value)}
            />
          ) : null}
          {ruleUsesBukOvertime ? (
            <TextField
              id="setup-rule-overtime-multiplier"
              label="Recargo hora extra"
              type="number"
              min="0.1"
              step="0.01"
              inputMode="decimal"
              value={ruleOvertimeMultiplierDraft}
              onChange={(event) => setRuleOvertimeMultiplierDraft(event.target.value)}
            />
          ) : null}
          <SelectField
            id="setup-rule-contract"
            label="Contrato (opcional)"
            value={ruleContractCodeDraft}
            onChange={(event) => setRuleContractCodeDraft(event.target.value)}
            options={contractOptions}
            placeholder="Todos los contratos"
          />
          <SelectField
            id="setup-rule-job-title"
            label="Cargo BUK (opcional)"
            value={ruleJobTitleDraft}
            onChange={(event) => setRuleJobTitleDraft(event.target.value)}
            options={bukJobTitleOptions}
            placeholder="Todos los cargos"
          />
          <SelectField
            id="setup-rule-union-name"
            label="Sindicato BUK (opcional)"
            value={ruleUnionNameDraft}
            onChange={(event) => setRuleUnionNameDraft(event.target.value)}
            options={bukUnionOptions}
            placeholder="Cualquier sindicato"
          />
          <TextField
            id="setup-rule-priority"
            label="Prioridad"
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={rulePriorityDraft}
            onChange={(event) => setRulePriorityDraft(event.target.value)}
          />
          <TextField
            id="setup-rule-valid-from"
            label="Vigencia desde"
            type="date"
            value={ruleValidFromDraft}
            onChange={(event) => setRuleValidFromDraft(event.target.value)}
          />
          <TextField
            id="setup-rule-valid-to"
            label="Vigencia hasta"
            type="date"
            value={ruleValidToDraft}
            onChange={(event) => setRuleValidToDraft(event.target.value)}
          />
        </div>

        <div className="action-row">
          <button
            type="button"
            className="soft-primary-button soft-primary-button-success"
            disabled={
              rateRuleMutation.isPending ||
              !ruleTypeIdDraft ||
              (ruleUsesBukOvertime ? false : !ruleAmountDraft) ||
              (ruleAmountDraft.trim().length > 0 && Number(ruleAmountDraft) < 0) ||
              (ruleFallbackBaseSalaryDraft.trim().length > 0 &&
                Number(ruleFallbackBaseSalaryDraft) < 0) ||
              (ruleFallbackWeeklyHoursDraft.trim().length > 0 &&
                Number(ruleFallbackWeeklyHoursDraft) <= 0) ||
              (ruleOvertimeMultiplierDraft.trim().length > 0 &&
                Number(ruleOvertimeMultiplierDraft) <= 0)
            }
            onClick={() =>
              rateRuleMutation.mutate({
                incentiveTypeId: ruleTypeIdDraft,
                amount: ruleAmountDraft.trim().length > 0 ? Number(ruleAmountDraft) : 0,
                contractCode: ruleContractCodeDraft || null,
                jobTitle: ruleJobTitleDraft || null,
                unionName: ruleUnionNameDraft || null,
                priority: Number(rulePriorityDraft || "100"),
                validFrom: ruleValidFromDraft || null,
                validTo: ruleValidToDraft || null,
                fallbackBaseSalary:
                  ruleFallbackBaseSalaryDraft.trim().length > 0
                    ? Number(ruleFallbackBaseSalaryDraft)
                    : null,
                fallbackWeeklyHours:
                  ruleFallbackWeeklyHoursDraft.trim().length > 0
                    ? Number(ruleFallbackWeeklyHoursDraft)
                    : null,
                overtimeMultiplier:
                  ruleOvertimeMultiplierDraft.trim().length > 0
                    ? Number(ruleOvertimeMultiplierDraft)
                    : null
              })
            }
          >
            Guardar regla
          </button>
          <SelectField
            id="setup-rule-status-filter"
            label="Ver"
            value={ruleStatusFilter}
            onChange={(event) =>
              setRuleStatusFilter(
                event.target.value === "active" || event.target.value === "inactive"
                  ? event.target.value
                  : "all"
              )
            }
            options={[
              { value: "all", label: "Todos" },
              { value: "active", label: "Solo activas" },
              { value: "inactive", label: "Solo inactivas" }
            ]}
          />
        </div>

        {errorMessage ? <p className="form-status form-status-error">{errorMessage}</p> : null}
        {statusMessage ? <p className="form-status">{statusMessage}</p> : null}

        <div className="tracking-table-wrap">
          <div className="tracking-table-scroll">
            <table className="tracking-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Tipo</th>
                  <th>Contrato</th>
                  <th>Cargo</th>
                  <th>Sindicato</th>
                  <th>Motor</th>
                  <th>Monto</th>
                  <th>Fallback</th>
                  <th>Prioridad</th>
                  <th>Vigencia</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {filteredRateRules.map((item) => (
                  <tr key={item.id}>
                    <td>{typeCodeById.get(item.incentiveTypeId) ?? "-"}</td>
                    <td>{item.incentiveTypeName}</td>
                    <td>{item.contractCode || "Todos"}</td>
                    <td>{item.jobTitle || "Todos"}</td>
                    <td>
                      {item.unionName || "Todos"}
                    </td>
                    <td>
                      {typeById.get(item.incentiveTypeId)?.hourRateStrategy === "buk_overtime"
                        ? "Hora extra BUK"
                        : "Regla directa"}
                    </td>
                    <td>{formatNumberValue(item.amount, "0")}</td>
                    <td>
                      {typeById.get(item.incentiveTypeId)?.hourRateStrategy === "buk_overtime"
                        ? item.fallbackBaseSalary !== null && item.fallbackWeeklyHours !== null
                          ? `${formatNumberValue(item.fallbackBaseSalary, "0")} / ${formatNumberValue(item.fallbackWeeklyHours, "0.##")}h x ${formatNumberValue(item.overtimeMultiplier, "0.##")}`
                          : "Sin fallback salarial"
                        : "No aplica"}
                    </td>
                    <td>{item.priority}</td>
                    <td>
                      {(item.validFrom || "Siempre") +
                        " · " +
                        (item.validTo || "Abierta")}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="soft-primary-button hr-incentives-inline-button"
                        disabled={toggleRuleMutation.isPending}
                        onClick={() =>
                          toggleRuleMutation.mutate({
                            id: item.id,
                            isActive: !item.isActive
                          })
                        }
                      >
                        {item.isActive ? "Desactivar" : "Activar"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </section>
  );
}
