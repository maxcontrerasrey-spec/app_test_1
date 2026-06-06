import { useState } from "react";
import { useMutation, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { SelectField, TextField } from "../../../shared/ui";
import { queryKeys } from "../../../shared/lib/queryKeys";
import {
  addHrIncentiveAllowedJobTitle,
  addHrIncentiveRateRule,
  addHrIncentiveType,
  setHrIncentiveAllowedJobTitleStatus,
  setHrIncentiveRateRuleStatus,
  setHrIncentiveTypeStatus
} from "../services/incentivesApi";
import type { HrIncentiveSetupCatalogs } from "../types";

type IncentiveSetupViewProps = {
  setupCatalogsQuery: UseQueryResult<HrIncentiveSetupCatalogs, Error>;
};

export function IncentiveSetupView({ setupCatalogsQuery }: IncentiveSetupViewProps) {
  const queryClient = useQueryClient();
  const [jobTitleDraft, setJobTitleDraft] = useState("");
  const [typeCodeDraft, setTypeCodeDraft] = useState("");
  const [typeNameDraft, setTypeNameDraft] = useState("");
  const [typeBasisDraft, setTypeBasisDraft] = useState<"fixed" | "per_hour">("fixed");
  const [typeRequiresReplacementDraft, setTypeRequiresReplacementDraft] = useState("false");
  const [ruleTypeIdDraft, setRuleTypeIdDraft] = useState("");
  const [ruleAmountDraft, setRuleAmountDraft] = useState("");
  const [ruleContractCodeDraft, setRuleContractCodeDraft] = useState("");
  const [ruleJobTitleDraft, setRuleJobTitleDraft] = useState("");
  const [rulePriorityDraft, setRulePriorityDraft] = useState("100");
  const [ruleValidFromDraft, setRuleValidFromDraft] = useState("");
  const [ruleValidToDraft, setRuleValidToDraft] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const refreshSetupCatalogs = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.incentives.setupCatalogs() });

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
      setTypeRequiresReplacementDraft("false");
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
      setRuleContractCodeDraft("");
      setRuleJobTitleDraft("");
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

  const toggleRuleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      setHrIncentiveRateRuleStatus(id, isActive),
    onSuccess: refreshSetupCatalogs
  });

  return (
    <section className="hr-incentives-setup-grid">
      <section className="hr-incentives-card">
        <div className="tracking-toolbar-copy">
          <h3>Cargos elegibles BUK</h3>
          <span className="tracking-filter-caption">
            Solo estos cargos aparecerán al buscar trabajadores para incentivos.
          </span>
        </div>

        <div className="hr-incentives-inline-form">
          <TextField
            id="setup-job-title"
            label="Cargo BUK"
            value={jobTitleDraft}
            onChange={(event) => setJobTitleDraft(event.target.value)}
            placeholder="Ej.: CONDUCTOR DE BUS"
          />
          <button
            type="button"
            className="soft-primary-button soft-primary-button-success"
            disabled={jobTitleMutation.isPending || !jobTitleDraft.trim()}
            onClick={() => jobTitleMutation.mutate(jobTitleDraft)}
          >
            Guardar cargo
          </button>
        </div>

        <div className="hr-incentives-list">
          {(setupCatalogsQuery.data?.allowedJobTitles ?? []).map((item) => (
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

      <section className="hr-incentives-card">
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
        </div>

        <div className="action-row">
          <button
            type="button"
            className="soft-primary-button soft-primary-button-success"
            disabled={
              incentiveTypeMutation.isPending || !typeCodeDraft.trim() || !typeNameDraft.trim()
            }
            onClick={() =>
              incentiveTypeMutation.mutate({
                code: typeCodeDraft.trim().toLowerCase(),
                name: typeNameDraft.trim(),
                calculationBasis: typeBasisDraft,
                requiresReplacement: typeRequiresReplacementDraft === "true"
              })
            }
          >
            Guardar tipo
          </button>
        </div>

        <div className="hr-incentives-list">
          {(setupCatalogsQuery.data?.incentiveTypes ?? []).map((item) => (
            <div key={item.id} className="hr-incentives-list-item">
              <div>
                <strong>{item.name}</strong>
                <span>
                  {item.calculationBasis === "per_hour" ? "Por hora" : "Monto fijo"} ·{" "}
                  {item.requiresReplacement ? "Con reemplazo" : "Sin reemplazo"}
                </span>
              </div>
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
          ))}
        </div>
      </section>

      <section className="hr-incentives-card hr-incentives-setup-rule-card">
        <div className="tracking-toolbar-copy">
          <h3>Reglas de monto</h3>
          <span className="tracking-filter-caption">
            El formulario usará automáticamente la regla más específica y vigente.
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
            label="Monto"
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            value={ruleAmountDraft}
            onChange={(event) => setRuleAmountDraft(event.target.value)}
          />
          <TextField
            id="setup-rule-contract"
            label="Contrato (opcional)"
            value={ruleContractCodeDraft}
            onChange={(event) => setRuleContractCodeDraft(event.target.value)}
            placeholder="Código contrato"
          />
          <TextField
            id="setup-rule-job-title"
            label="Cargo BUK (opcional)"
            value={ruleJobTitleDraft}
            onChange={(event) => setRuleJobTitleDraft(event.target.value)}
            placeholder="Cargo exacto"
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
              !ruleAmountDraft ||
              Number(ruleAmountDraft) < 0
            }
            onClick={() =>
              rateRuleMutation.mutate({
                incentiveTypeId: ruleTypeIdDraft,
                amount: Number(ruleAmountDraft),
                contractCode: ruleContractCodeDraft || null,
                jobTitle: ruleJobTitleDraft || null,
                priority: Number(rulePriorityDraft || "100"),
                validFrom: ruleValidFromDraft || null,
                validTo: ruleValidToDraft || null
              })
            }
          >
            Guardar regla
          </button>
        </div>

        {errorMessage ? <p className="form-status form-status-error">{errorMessage}</p> : null}
        {statusMessage ? <p className="form-status">{statusMessage}</p> : null}

        <div className="tracking-table-wrap">
          <div className="tracking-table-scroll">
            <table className="tracking-table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Contrato</th>
                  <th>Cargo</th>
                  <th>Monto</th>
                  <th>Prioridad</th>
                  <th>Vigencia</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {(setupCatalogsQuery.data?.rateRules ?? []).map((item) => (
                  <tr key={item.id}>
                    <td>{item.incentiveTypeName}</td>
                    <td>{item.contractCode || "Todos"}</td>
                    <td>{item.jobTitle || "Todos"}</td>
                    <td>{new Intl.NumberFormat("es-CL").format(item.amount)}</td>
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
