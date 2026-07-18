import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { SearchableSelectField, SelectField, type SelectOption, TextField, FieldHintIcon } from "../../../shared/ui";
import { invalidateAccreditationQueries, useAccreditationSetupCatalogs } from "../hooks/useAccreditationQueries";
import {
  saveAccreditationMatrixRule,
  saveAccreditationRequirement,
  saveAccreditationSite,
  saveAccreditationSiteStandard,
  saveAccreditationStandard,
  saveAccreditationStandardRequirement
} from "../services/accreditationApi";
import type {
  AccreditationFieldGuide,
  AccreditationMatrixRule,
  AccreditationRequirement,
  AccreditationSite,
  AccreditationSiteStandardRule,
  AccreditationStandard,
  AccreditationStandardRequirementRule
} from "../types";

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
  processScope: "accreditation" as "accreditation" | "internal_license" | "both",
  requiresExpiryDate: false,
  isMandatory: true,
  blocksAccreditation: true
};

const defaultStandardForm = {
  standardId: "",
  code: "",
  name: "",
  ownerName: "",
  description: ""
};

const defaultStandardRequirementForm = {
  ruleId: "",
  standardId: "",
  requirementId: "",
  sortOrder: "0",
  notes: ""
};

const defaultSiteStandardForm = {
  ruleId: "",
  siteId: "",
  standardId: "",
  notes: ""
};

const defaultMatrixForm = {
  ruleId: "",
  siteId: "",
  requirementId: "",
  jobTitle: "",
  sortOrder: "0",
  notes: ""
};

const fallbackSiteTypeOptions: SelectOption[] = [
  { value: "contract", label: "Contrato" },
  { value: "cost_center", label: "Centro de costo" },
  { value: "project", label: "Proyecto" },
  { value: "site", label: "Instalacion" },
  { value: "other", label: "Otro" }
];

const fallbackRequirementCategoryOptions: SelectOption[] = [
  { value: "general", label: "General" },
  { value: "documental", label: "Documental" },
  { value: "seguridad", label: "Seguridad" },
  { value: "salud", label: "Salud" },
  { value: "operacional", label: "Operacional" },
  { value: "habilitante", label: "Habilitante" }
];

const fallbackProcessScopeOptions: SelectOption[] = [
  { value: "accreditation", label: "Acreditacion ingreso" },
  { value: "internal_license", label: "Licencia interna" },
  { value: "both", label: "Ingreso y licencia interna" }
];

function getFieldHint(guides: AccreditationFieldGuide[], key: string, fallback?: string) {
  const guide = guides.find((item) => item.key === key);
  if (!guide) {
    return fallback;
  }

  return `${guide.description} Fuente: ${guide.source}. Guarda en ${guide.target}.`;
}

export function AccreditationSettingsView() {
  const queryClient = useQueryClient();
  const setupQuery = useAccreditationSetupCatalogs();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [siteForm, setSiteForm] = useState(defaultSiteForm);
  const [requirementForm, setRequirementForm] = useState(defaultRequirementForm);
  const [standardForm, setStandardForm] = useState(defaultStandardForm);
  const [standardRequirementForm, setStandardRequirementForm] = useState(defaultStandardRequirementForm);
  const [siteStandardForm, setSiteStandardForm] = useState(defaultSiteStandardForm);
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

  const siteTypeOptions = useMemo(() => {
    const options = setupQuery.data?.metadata.siteTypes ?? [];
    if (!options.length) {
      return fallbackSiteTypeOptions;
    }

    return options.map((option) => ({ value: option.value, label: option.label }));
  }, [setupQuery.data?.metadata.siteTypes]);

  const requirementOptions = useMemo(
    () =>
      (setupQuery.data?.requirements ?? []).map((requirement) => ({
        value: requirement.id,
        label: `${requirement.category} · ${requirement.name}`
      })),
    [setupQuery.data?.requirements]
  );

  const standardOptions = useMemo(
    () =>
      (setupQuery.data?.standards ?? []).map((standard) => ({
        value: standard.id,
        label: standard.ownerName ? `${standard.name} · ${standard.ownerName}` : standard.name
      })),
    [setupQuery.data?.standards]
  );

  const requirementCategoryOptions = useMemo(() => {
    const options = setupQuery.data?.metadata.requirementCategories ?? [];
    if (!options.length) {
      return fallbackRequirementCategoryOptions;
    }

    return options.map((option) => ({ value: option.value, label: option.label }));
  }, [setupQuery.data?.metadata.requirementCategories]);

  const processScopeOptions = useMemo(() => {
    const options = setupQuery.data?.metadata.processScopes ?? [];
    if (!options.length) {
      return fallbackProcessScopeOptions;
    }

    return options.map((option) => ({ value: option.value, label: option.label }));
  }, [setupQuery.data?.metadata.processScopes]);

  const contractOptions = useMemo(() => {
    const sourceOptions = setupQuery.data?.contractOptions ?? [];
    const selectedOption =
      siteForm.contractCode.trim() && !sourceOptions.some((option) => option.value === siteForm.contractCode)
        ? [{ value: siteForm.contractCode, label: `${siteForm.contractCode} · manual` }]
        : [];

    return [
      ...selectedOption,
      ...sourceOptions.map((option) => ({ value: option.value, label: option.label }))
    ];
  }, [setupQuery.data?.contractOptions, siteForm.contractCode]);

  const areaOptions = useMemo(() => {
    const sourceOptions = setupQuery.data?.areaOptions ?? [];
    const selectedOption =
      siteForm.areaCode.trim() && !sourceOptions.some((option) => option.value === siteForm.areaCode)
        ? [{ value: siteForm.areaCode, label: `${siteForm.areaCode} · manual` }]
        : [];

    return [
      ...selectedOption,
      ...sourceOptions.map((option) => ({ value: option.value, label: option.label }))
    ];
  }, [setupQuery.data?.areaOptions, siteForm.areaCode]);

  const contractAreaMap = useMemo(
    () =>
      new Map(
        (setupQuery.data?.contractOptions ?? []).map((option) => [option.value, option.areaCode ?? ""])
      ),
    [setupQuery.data?.contractOptions]
  );

  const matrixJobTitleOptions = useMemo(() => {
    const bukOptions = setupQuery.data?.bukJobTitles ?? [];
    const selectedOption =
      matrixForm.jobTitle.trim() && !bukOptions.some((option) => option.value === matrixForm.jobTitle)
        ? [{ value: matrixForm.jobTitle, label: `${matrixForm.jobTitle} · manual` }]
        : [];

    return [
      { value: "", label: "Todos los cargos de la faena" },
      ...selectedOption,
      ...bukOptions
    ];
  }, [matrixForm.jobTitle, setupQuery.data?.bukJobTitles]);

  const siteGuides = setupQuery.data?.metadata.fieldGuides.site ?? [];
  const requirementGuides = setupQuery.data?.metadata.fieldGuides.requirement ?? [];
  const matrixGuides = setupQuery.data?.metadata.fieldGuides.matrix ?? [];

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
        processScope: requirementForm.processScope,
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

  async function handleSaveStandard() {
    setIsSaving(true);
    setFeedback(null);
    try {
      await saveAccreditationStandard({
        standardId: standardForm.standardId || null,
        code: standardForm.code,
        name: standardForm.name,
        ownerName: standardForm.ownerName || null,
        description: standardForm.description || null
      });
      await invalidateAccreditationQueries(queryClient);
      setStandardForm(defaultStandardForm);
      setFeedback("Estandar guardado.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveStandardRequirement() {
    setIsSaving(true);
    setFeedback(null);
    try {
      await saveAccreditationStandardRequirement({
        ruleId: standardRequirementForm.ruleId || null,
        standardId: standardRequirementForm.standardId,
        requirementId: standardRequirementForm.requirementId,
        sortOrder: Number(standardRequirementForm.sortOrder || 0),
        notes: standardRequirementForm.notes || null
      });
      await invalidateAccreditationQueries(queryClient);
      setStandardRequirementForm(defaultStandardRequirementForm);
      setFeedback("Requisito de estandar guardado.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveSiteStandard() {
    setIsSaving(true);
    setFeedback(null);
    try {
      await saveAccreditationSiteStandard({
        ruleId: siteStandardForm.ruleId || null,
        siteId: siteStandardForm.siteId,
        standardId: siteStandardForm.standardId,
        notes: siteStandardForm.notes || null
      });
      await invalidateAccreditationQueries(queryClient);
      setSiteStandardForm(defaultSiteStandardForm);
      setFeedback("Estandar asignado a faena.");
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
      processScope: requirement.processScope,
      requiresExpiryDate: requirement.requiresExpiryDate,
      isMandatory: requirement.isMandatory,
      blocksAccreditation: requirement.blocksAccreditation
    });
  }

  function handleSiteContractChange(contractCode: string) {
    const suggestedAreaCode = contractAreaMap.get(contractCode) ?? "";

    setSiteForm((current) => ({
      ...current,
      contractCode,
      areaCode: suggestedAreaCode || current.areaCode
    }));
  }

  function loadStandard(standard: AccreditationStandard) {
    setStandardForm({
      standardId: standard.id,
      code: standard.code,
      name: standard.name,
      ownerName: standard.ownerName ?? "",
      description: standard.description ?? ""
    });
  }

  function loadStandardRequirementRule(rule: AccreditationStandardRequirementRule) {
    setStandardRequirementForm({
      ruleId: rule.id,
      standardId: rule.standardId,
      requirementId: rule.requirementId,
      sortOrder: String(rule.sortOrder),
      notes: rule.notes ?? ""
    });
  }

  function loadSiteStandardRule(rule: AccreditationSiteStandardRule) {
    setSiteStandardForm({
      ruleId: rule.id,
      siteId: rule.siteId,
      standardId: rule.standardId,
      notes: rule.notes ?? ""
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
              hint={getFieldHint(siteGuides, "code")}
            />
            <TextField
              id="accreditation-site-name"
              label="Nombre"
              value={siteForm.name}
              onChange={(event) => setSiteForm((current) => ({ ...current, name: event.target.value }))}
              hint={getFieldHint(siteGuides, "name")}
            />
            <SelectField
              id="accreditation-site-type"
              label="Tipo"
              value={siteForm.siteType}
              onChange={(event) => setSiteForm((current) => ({ ...current, siteType: event.target.value }))}
              options={siteTypeOptions}
              hint={getFieldHint(siteGuides, "site_type")}
            />
            <SearchableSelectField
              id="accreditation-site-contract"
              label="Codigo contrato"
              value={siteForm.contractCode}
              onChange={(event) => handleSiteContractChange(event.target.value)}
              options={contractOptions}
              placeholder="Selecciona un contrato activo"
              hint={getFieldHint(siteGuides, "contract_code")}
            />
          </div>
          <div className="field-grid">
            <SearchableSelectField
              id="accreditation-site-area"
              label="Codigo area"
              value={siteForm.areaCode}
              onChange={(event) => setSiteForm((current) => ({ ...current, areaCode: event.target.value }))}
              options={areaOptions}
              placeholder="Selecciona un CECO o area"
              hint={getFieldHint(siteGuides, "area_code")}
            />
            <TextField
              id="accreditation-site-description"
              label="Descripcion"
              value={siteForm.description}
              onChange={(event) => setSiteForm((current) => ({ ...current, description: event.target.value }))}
              hint={getFieldHint(siteGuides, "description")}
            />
          </div>
          <div className="action-row">
            <button type="button" className="soft-primary-button soft-primary-button-success" onClick={() => void handleSaveSite()} disabled={isSaving}>
              Guardar faena
            </button>
            <button type="button" className="soft-primary-button soft-primary-button-neutral" onClick={() => setSiteForm(defaultSiteForm)}>
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
              hint={getFieldHint(requirementGuides, "code")}
            />
            <TextField
              id="accreditation-requirement-name"
              label="Nombre"
              value={requirementForm.name}
              onChange={(event) => setRequirementForm((current) => ({ ...current, name: event.target.value }))}
              hint={getFieldHint(requirementGuides, "name")}
            />
            <SelectField
              id="accreditation-requirement-category"
              label="Categoria"
              value={requirementForm.category}
              onChange={(event) => setRequirementForm((current) => ({ ...current, category: event.target.value }))}
              options={requirementCategoryOptions}
              hint={getFieldHint(requirementGuides, "category")}
            />
            <TextField
              id="accreditation-requirement-alert"
              label="Alerta dias"
              value={requirementForm.alertDaysBeforeExpiry}
              onChange={(event) =>
                setRequirementForm((current) => ({ ...current, alertDaysBeforeExpiry: event.target.value }))
              }
              inputMode="numeric"
              hint={getFieldHint(requirementGuides, "alert_days_before_expiry")}
            />
          </div>
          <div className="field-grid">
            <TextField
              id="accreditation-requirement-validity"
              label="Vigencia dias"
              value={requirementForm.validityDays}
              onChange={(event) => setRequirementForm((current) => ({ ...current, validityDays: event.target.value }))}
              inputMode="numeric"
              hint={getFieldHint(requirementGuides, "validity_days")}
            />
            <TextField
              id="accreditation-requirement-description"
              label="Descripcion"
              value={requirementForm.description}
              onChange={(event) => setRequirementForm((current) => ({ ...current, description: event.target.value }))}
              hint={getFieldHint(requirementGuides, "description")}
            />
            <SelectField
              id="accreditation-requirement-process-scope"
              label="Alcance"
              value={requirementForm.processScope}
              onChange={(event) =>
                setRequirementForm((current) => ({
                  ...current,
                  processScope: event.target.value as "accreditation" | "internal_license" | "both"
                }))
              }
              options={processScopeOptions}
              hint={getFieldHint(requirementGuides, "process_scope")}
            />
          </div>
          <div className="accreditation-toggle-row">
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input
                type="checkbox"
                checked={requirementForm.isMandatory}
                onChange={(event) =>
                  setRequirementForm((current) => ({ ...current, isMandatory: event.target.checked }))
                }
              />
              Obligatorio
              <FieldHintIcon hint={getFieldHint(requirementGuides, "is_mandatory")} />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input
                type="checkbox"
                checked={requirementForm.requiresExpiryDate}
                onChange={(event) =>
                  setRequirementForm((current) => ({ ...current, requiresExpiryDate: event.target.checked }))
                }
              />
              Requiere vencimiento
              <FieldHintIcon hint={getFieldHint(requirementGuides, "requires_expiry_date")} />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input
                type="checkbox"
                checked={requirementForm.blocksAccreditation}
                onChange={(event) =>
                  setRequirementForm((current) => ({ ...current, blocksAccreditation: event.target.checked }))
                }
              />
              Bloquea acreditacion
              <FieldHintIcon hint={getFieldHint(requirementGuides, "blocks_accreditation")} />
            </label>
          </div>
          <div className="action-row">
            <button
              type="button"
              className="soft-primary-button soft-primary-button-success"
              onClick={() => void handleSaveRequirement()}
              disabled={isSaving}
            >
              Guardar requisito
            </button>
            <button type="button" className="soft-primary-button soft-primary-button-neutral" onClick={() => setRequirementForm(defaultRequirementForm)}>
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
                <span>{requirement.category} · {requirement.processScope}</span>
              </button>
            ))}
          </div>
        </article>
      </div>

      <div className="accreditation-settings-grid">
        <article className="info-card accreditation-settings-card">
          <h3>Estandares</h3>
          <div className="field-grid">
            <TextField
              id="accreditation-standard-code"
              label="Codigo"
              value={standardForm.code}
              onChange={(event) => setStandardForm((current) => ({ ...current, code: event.target.value }))}
            />
            <TextField
              id="accreditation-standard-name"
              label="Nombre"
              value={standardForm.name}
              onChange={(event) => setStandardForm((current) => ({ ...current, name: event.target.value }))}
            />
            <TextField
              id="accreditation-standard-owner"
              label="Mandante"
              value={standardForm.ownerName}
              onChange={(event) => setStandardForm((current) => ({ ...current, ownerName: event.target.value }))}
            />
            <TextField
              id="accreditation-standard-description"
              label="Descripcion"
              value={standardForm.description}
              onChange={(event) => setStandardForm((current) => ({ ...current, description: event.target.value }))}
            />
          </div>
          <div className="action-row">
            <button type="button" className="soft-primary-button soft-primary-button-success" onClick={() => void handleSaveStandard()} disabled={isSaving}>
              Guardar estandar
            </button>
            <button type="button" className="soft-primary-button soft-primary-button-neutral" onClick={() => setStandardForm(defaultStandardForm)}>
              Limpiar
            </button>
          </div>
          <div className="accreditation-inline-list">
            {(setupQuery.data?.standards ?? []).map((standard) => (
              <button type="button" key={standard.id} className="accreditation-inline-list-item" onClick={() => loadStandard(standard)}>
                <strong>{standard.name}</strong>
                <span>{standard.ownerName ?? standard.code}</span>
              </button>
            ))}
          </div>
        </article>

        <article className="info-card accreditation-settings-card">
          <h3>Requisitos por Estandar</h3>
          <div className="field-grid">
            <SelectField
              id="accreditation-standard-requirement-standard"
              label="Estandar"
              value={standardRequirementForm.standardId}
              onChange={(event) => setStandardRequirementForm((current) => ({ ...current, standardId: event.target.value }))}
              options={standardOptions}
              placeholder="Selecciona un estandar"
            />
            <SelectField
              id="accreditation-standard-requirement-requirement"
              label="Requisito"
              value={standardRequirementForm.requirementId}
              onChange={(event) => setStandardRequirementForm((current) => ({ ...current, requirementId: event.target.value }))}
              options={requirementOptions}
              placeholder="Selecciona un requisito"
            />
            <TextField
              id="accreditation-standard-requirement-order"
              label="Orden"
              value={standardRequirementForm.sortOrder}
              onChange={(event) => setStandardRequirementForm((current) => ({ ...current, sortOrder: event.target.value }))}
              inputMode="numeric"
            />
            <TextField
              id="accreditation-standard-requirement-notes"
              label="Notas"
              value={standardRequirementForm.notes}
              onChange={(event) => setStandardRequirementForm((current) => ({ ...current, notes: event.target.value }))}
            />
          </div>
          <div className="action-row">
            <button type="button" className="soft-primary-button soft-primary-button-success" onClick={() => void handleSaveStandardRequirement()} disabled={isSaving}>
              Guardar requisito
            </button>
            <button type="button" className="soft-primary-button soft-primary-button-neutral" onClick={() => setStandardRequirementForm(defaultStandardRequirementForm)}>
              Limpiar
            </button>
          </div>
          <div className="accreditation-inline-list">
            {(setupQuery.data?.standardRequirementRules ?? []).map((rule) => (
              <button type="button" key={rule.id} className="accreditation-inline-list-item" onClick={() => loadStandardRequirementRule(rule)}>
                <strong>{rule.standardName}</strong>
                <span>{rule.requirementName} · {rule.processScope}</span>
              </button>
            ))}
          </div>
        </article>
      </div>

      <article className="info-card accreditation-settings-card">
        <h3>Estandares por Faena</h3>
        <div className="field-grid accreditation-matrix-form-grid">
          <SelectField
            id="accreditation-site-standard-site"
            label="Faena"
            value={siteStandardForm.siteId}
            onChange={(event) => setSiteStandardForm((current) => ({ ...current, siteId: event.target.value }))}
            options={siteOptions}
            placeholder="Selecciona una faena"
          />
          <SelectField
            id="accreditation-site-standard-standard"
            label="Estandar"
            value={siteStandardForm.standardId}
            onChange={(event) => setSiteStandardForm((current) => ({ ...current, standardId: event.target.value }))}
            options={standardOptions}
            placeholder="Selecciona un estandar"
          />
          <TextField
            id="accreditation-site-standard-notes"
            label="Notas"
            value={siteStandardForm.notes}
            onChange={(event) => setSiteStandardForm((current) => ({ ...current, notes: event.target.value }))}
          />
        </div>
        <div className="action-row">
          <button type="button" className="soft-primary-button soft-primary-button-success" onClick={() => void handleSaveSiteStandard()} disabled={isSaving}>
            Asignar estandar
          </button>
          <button type="button" className="soft-primary-button soft-primary-button-neutral" onClick={() => setSiteStandardForm(defaultSiteStandardForm)}>
            Limpiar
          </button>
        </div>
        <div className="accreditation-matrix-list">
          {(setupQuery.data?.siteStandardRules ?? []).map((rule) => (
            <button type="button" key={rule.id} className="accreditation-inline-list-item" onClick={() => loadSiteStandardRule(rule)}>
              <strong>{rule.siteName}</strong>
              <span>{rule.standardName}</span>
            </button>
          ))}
        </div>
      </article>

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
            hint={getFieldHint(matrixGuides, "site_id")}
          />
          <SelectField
            id="accreditation-matrix-requirement"
            label="Requisito"
            value={matrixForm.requirementId}
            onChange={(event) => setMatrixForm((current) => ({ ...current, requirementId: event.target.value }))}
            options={requirementOptions}
            placeholder="Selecciona un requisito"
            hint={getFieldHint(matrixGuides, "requirement_id")}
          />
          <SearchableSelectField
            id="accreditation-matrix-job-title"
            label="Cargo exacto"
            value={matrixForm.jobTitle}
            onChange={(event) => setMatrixForm((current) => ({ ...current, jobTitle: event.target.value }))}
            options={matrixJobTitleOptions}
            placeholder="Todos los cargos o busca uno de BUK"
            hint={getFieldHint(matrixGuides, "job_title", "Si queda vacio, la regla aplica a toda la faena.")}
          />
          <TextField
            id="accreditation-matrix-sort-order"
            label="Orden"
            value={matrixForm.sortOrder}
            onChange={(event) => setMatrixForm((current) => ({ ...current, sortOrder: event.target.value }))}
            inputMode="numeric"
            hint={getFieldHint(matrixGuides, "sort_order")}
          />
          <TextField
            id="accreditation-matrix-notes"
            label="Notas"
            value={matrixForm.notes}
            onChange={(event) => setMatrixForm((current) => ({ ...current, notes: event.target.value }))}
            hint={getFieldHint(matrixGuides, "notes")}
          />
        </div>

        <div className="action-row">
          <button
            type="button"
            className="soft-primary-button soft-primary-button-success"
            onClick={() => void handleSaveMatrixRule()}
            disabled={isSaving}
          >
            Guardar regla
          </button>
          <button type="button" className="soft-primary-button soft-primary-button-neutral" onClick={() => setMatrixForm(defaultMatrixForm)}>
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
