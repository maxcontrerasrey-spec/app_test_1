import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { SelectField, TextField } from "../../../shared/ui";
import { invalidateAccreditationQueries, useAccreditationSetupCatalogs } from "../hooks/useAccreditationQueries";
import {
  saveAccreditationMatrixRule,
  saveAccreditationRequirement,
  saveAccreditationSite
} from "../services/accreditationApi";
import type { AccreditationMatrixRule, AccreditationRequirement, AccreditationSite } from "../types";

const defaultSiteForm = {
  siteId: "",
  code: "",
  name: "",
  siteType: "contract",
  contractCode: "",
  areaCode: "",
  description: ""
};

const defaultRequirementForm = {
  requirementId: "",
  code: "",
  name: "",
  category: "general",
  description: "",
  alertDaysBeforeExpiry: "30",
  validityDays: "",
  requiresExpiryDate: false,
  isMandatory: true,
  blocksAccreditation: true
};

const defaultMatrixForm = {
  ruleId: "",
  siteId: "",
  requirementId: "",
  jobTitle: "",
  sortOrder: "0",
  notes: ""
};

export function AccreditationSettingsView() {
  const queryClient = useQueryClient();
  const setupQuery = useAccreditationSetupCatalogs();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [siteForm, setSiteForm] = useState(defaultSiteForm);
  const [requirementForm, setRequirementForm] = useState(defaultRequirementForm);
  const [matrixForm, setMatrixForm] = useState(defaultMatrixForm);
  const [isSaving, setIsSaving] = useState(false);

  const siteOptions = useMemo(
    () =>
      (setupQuery.data?.sites ?? []).map((site) => ({
        value: site.id,
        label: `${site.name}${site.contractCode ? ` · ${site.contractCode}` : ""}`
      })),
    [setupQuery.data?.sites]
  );

  const requirementOptions = useMemo(
    () =>
      (setupQuery.data?.requirements ?? []).map((requirement) => ({
        value: requirement.id,
        label: `${requirement.category} · ${requirement.name}`
      })),
    [setupQuery.data?.requirements]
  );

  async function handleSaveSite() {
    setIsSaving(true);
    setFeedback(null);
    try {
      await saveAccreditationSite({
        siteId: siteForm.siteId || null,
        code: siteForm.code,
        name: siteForm.name,
        siteType: siteForm.siteType,
        contractCode: siteForm.contractCode || null,
        areaCode: siteForm.areaCode || null,
        description: siteForm.description || null
      });
      await invalidateAccreditationQueries(queryClient);
      setSiteForm(defaultSiteForm);
      setFeedback("Faena guardada.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveRequirement() {
    setIsSaving(true);
    setFeedback(null);
    try {
      await saveAccreditationRequirement({
        requirementId: requirementForm.requirementId || null,
        code: requirementForm.code,
        name: requirementForm.name,
        category: requirementForm.category,
        description: requirementForm.description || null,
        alertDaysBeforeExpiry: Number(requirementForm.alertDaysBeforeExpiry || 30),
        validityDays: requirementForm.validityDays ? Number(requirementForm.validityDays) : null,
        requiresExpiryDate: requirementForm.requiresExpiryDate,
        isMandatory: requirementForm.isMandatory,
        blocksAccreditation: requirementForm.blocksAccreditation
      });
      await invalidateAccreditationQueries(queryClient);
      setRequirementForm(defaultRequirementForm);
      setFeedback("Requisito guardado.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveMatrixRule() {
    setIsSaving(true);
    setFeedback(null);
    try {
      await saveAccreditationMatrixRule({
        ruleId: matrixForm.ruleId || null,
        siteId: matrixForm.siteId,
        requirementId: matrixForm.requirementId,
        jobTitle: matrixForm.jobTitle || null,
        sortOrder: Number(matrixForm.sortOrder || 0),
        notes: matrixForm.notes || null
      });
      await invalidateAccreditationQueries(queryClient);
      setMatrixForm(defaultMatrixForm);
      setFeedback("Regla de matriz guardada.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSaving(false);
    }
  }

  function loadSite(site: AccreditationSite) {
    setSiteForm({
      siteId: site.id,
      code: site.code,
      name: site.name,
      siteType: site.siteType,
      contractCode: site.contractCode ?? "",
      areaCode: site.areaCode ?? "",
      description: site.description ?? ""
    });
  }

  function loadRequirement(requirement: AccreditationRequirement) {
    setRequirementForm({
      requirementId: requirement.id,
      code: requirement.code,
      name: requirement.name,
      category: requirement.category,
      description: requirement.description ?? "",
      alertDaysBeforeExpiry: String(requirement.alertDaysBeforeExpiry),
      validityDays: requirement.validityDays ? String(requirement.validityDays) : "",
      requiresExpiryDate: requirement.requiresExpiryDate,
      isMandatory: requirement.isMandatory,
      blocksAccreditation: requirement.blocksAccreditation
    });
  }

  function loadMatrixRule(rule: AccreditationMatrixRule) {
    setMatrixForm({
      ruleId: rule.id,
      siteId: rule.siteId,
      requirementId: rule.requirementId,
      jobTitle: rule.jobTitle ?? "",
      sortOrder: String(rule.sortOrder),
      notes: rule.notes ?? ""
    });
  }

  return (
    <section className="tracking-panel accreditation-panel">
      {feedback ? <p className="tracking-filter-caption">{feedback}</p> : null}

      <div className="accreditation-settings-grid">
        <article className="info-card accreditation-settings-card">
          <h3>Faenas / Centros</h3>
          <div className="field-grid">
            <TextField
              id="accreditation-site-code"
              label="Codigo"
              value={siteForm.code}
              onChange={(event) => setSiteForm((current) => ({ ...current, code: event.target.value }))}
            />
            <TextField
              id="accreditation-site-name"
              label="Nombre"
              value={siteForm.name}
              onChange={(event) => setSiteForm((current) => ({ ...current, name: event.target.value }))}
            />
            <TextField
              id="accreditation-site-type"
              label="Tipo"
              value={siteForm.siteType}
              onChange={(event) => setSiteForm((current) => ({ ...current, siteType: event.target.value }))}
            />
            <TextField
              id="accreditation-site-contract"
              label="Codigo contrato"
              value={siteForm.contractCode}
              onChange={(event) => setSiteForm((current) => ({ ...current, contractCode: event.target.value }))}
            />
          </div>
          <div className="field-grid">
            <TextField
              id="accreditation-site-area"
              label="Codigo area"
              value={siteForm.areaCode}
              onChange={(event) => setSiteForm((current) => ({ ...current, areaCode: event.target.value }))}
            />
            <TextField
              id="accreditation-site-description"
              label="Descripcion"
              value={siteForm.description}
              onChange={(event) => setSiteForm((current) => ({ ...current, description: event.target.value }))}
            />
          </div>
          <div className="approval-chip-row">
            <button type="button" className="approval-chip tracking-kpi-card-active" onClick={() => void handleSaveSite()} disabled={isSaving}>
              Guardar faena
            </button>
            <button type="button" className="approval-chip" onClick={() => setSiteForm(defaultSiteForm)}>
              Limpiar
            </button>
          </div>

          <div className="accreditation-inline-list">
            {(setupQuery.data?.sites ?? []).map((site) => (
              <button type="button" key={site.id} className="accreditation-inline-list-item" onClick={() => loadSite(site)}>
                <strong>{site.name}</strong>
                <span>{site.contractCode ?? site.code}</span>
              </button>
            ))}
          </div>
        </article>

        <article className="info-card accreditation-settings-card">
          <h3>Requisitos</h3>
          <div className="field-grid">
            <TextField
              id="accreditation-requirement-code"
              label="Codigo"
              value={requirementForm.code}
              onChange={(event) => setRequirementForm((current) => ({ ...current, code: event.target.value }))}
            />
            <TextField
              id="accreditation-requirement-name"
              label="Nombre"
              value={requirementForm.name}
              onChange={(event) => setRequirementForm((current) => ({ ...current, name: event.target.value }))}
            />
            <TextField
              id="accreditation-requirement-category"
              label="Categoria"
              value={requirementForm.category}
              onChange={(event) => setRequirementForm((current) => ({ ...current, category: event.target.value }))}
            />
            <TextField
              id="accreditation-requirement-alert"
              label="Alerta dias"
              value={requirementForm.alertDaysBeforeExpiry}
              onChange={(event) =>
                setRequirementForm((current) => ({ ...current, alertDaysBeforeExpiry: event.target.value }))
              }
            />
          </div>
          <div className="field-grid">
            <TextField
              id="accreditation-requirement-validity"
              label="Vigencia dias"
              value={requirementForm.validityDays}
              onChange={(event) => setRequirementForm((current) => ({ ...current, validityDays: event.target.value }))}
            />
            <TextField
              id="accreditation-requirement-description"
              label="Descripcion"
              value={requirementForm.description}
              onChange={(event) => setRequirementForm((current) => ({ ...current, description: event.target.value }))}
            />
          </div>
          <div className="accreditation-toggle-row">
            <label>
              <input
                type="checkbox"
                checked={requirementForm.isMandatory}
                onChange={(event) =>
                  setRequirementForm((current) => ({ ...current, isMandatory: event.target.checked }))
                }
              />
              Obligatorio
            </label>
            <label>
              <input
                type="checkbox"
                checked={requirementForm.requiresExpiryDate}
                onChange={(event) =>
                  setRequirementForm((current) => ({ ...current, requiresExpiryDate: event.target.checked }))
                }
              />
              Requiere vencimiento
            </label>
            <label>
              <input
                type="checkbox"
                checked={requirementForm.blocksAccreditation}
                onChange={(event) =>
                  setRequirementForm((current) => ({ ...current, blocksAccreditation: event.target.checked }))
                }
              />
              Bloquea acreditacion
            </label>
          </div>
          <div className="approval-chip-row">
            <button
              type="button"
              className="approval-chip tracking-kpi-card-active"
              onClick={() => void handleSaveRequirement()}
              disabled={isSaving}
            >
              Guardar requisito
            </button>
            <button type="button" className="approval-chip" onClick={() => setRequirementForm(defaultRequirementForm)}>
              Limpiar
            </button>
          </div>

          <div className="accreditation-inline-list">
            {(setupQuery.data?.requirements ?? []).map((requirement) => (
              <button
                type="button"
                key={requirement.id}
                className="accreditation-inline-list-item"
                onClick={() => loadRequirement(requirement)}
              >
                <strong>{requirement.name}</strong>
                <span>{requirement.category}</span>
              </button>
            ))}
          </div>
        </article>
      </div>

      <article className="info-card accreditation-settings-card">
        <h3>Matriz de Requisitos</h3>
        <div className="field-grid accreditation-matrix-form-grid">
          <SelectField
            id="accreditation-matrix-site"
            label="Faena"
            value={matrixForm.siteId}
            onChange={(event) => setMatrixForm((current) => ({ ...current, siteId: event.target.value }))}
            options={siteOptions}
            placeholder="Selecciona una faena"
          />
          <SelectField
            id="accreditation-matrix-requirement"
            label="Requisito"
            value={matrixForm.requirementId}
            onChange={(event) => setMatrixForm((current) => ({ ...current, requirementId: event.target.value }))}
            options={requirementOptions}
            placeholder="Selecciona un requisito"
          />
          <TextField
            id="accreditation-matrix-job-title"
            label="Cargo exacto"
            value={matrixForm.jobTitle}
            onChange={(event) => setMatrixForm((current) => ({ ...current, jobTitle: event.target.value }))}
            placeholder="Vacío = aplica a toda la faena"
          />
          <TextField
            id="accreditation-matrix-sort-order"
            label="Orden"
            value={matrixForm.sortOrder}
            onChange={(event) => setMatrixForm((current) => ({ ...current, sortOrder: event.target.value }))}
          />
          <TextField
            id="accreditation-matrix-notes"
            label="Notas"
            value={matrixForm.notes}
            onChange={(event) => setMatrixForm((current) => ({ ...current, notes: event.target.value }))}
          />
        </div>

        <div className="approval-chip-row">
          <button
            type="button"
            className="approval-chip tracking-kpi-card-active"
            onClick={() => void handleSaveMatrixRule()}
            disabled={isSaving}
          >
            Guardar regla
          </button>
          <button type="button" className="approval-chip" onClick={() => setMatrixForm(defaultMatrixForm)}>
            Limpiar
          </button>
        </div>

        <div className="accreditation-matrix-list">
          {(setupQuery.data?.matrixRules ?? []).map((rule) => (
            <button type="button" key={rule.id} className="accreditation-inline-list-item" onClick={() => loadMatrixRule(rule)}>
              <strong>{rule.siteName}</strong>
              <span>
                {rule.requirementName}
                {rule.jobTitle ? ` · ${rule.jobTitle}` : " · Global"}
              </span>
            </button>
          ))}
        </div>
      </article>
    </section>
  );
}
