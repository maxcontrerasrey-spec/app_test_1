import { useEffect, useMemo, useState } from "react";
import { PageShell } from "../../../shared/ui";
import { useRentStructureControl, useSaveRentStructureConfig } from "../hooks/useRentStructuresQueries";
import type { RentLegalCatalog, RentStructureConfigLine, RentStructureLegalConfig, RentStructureLine } from "../services/rentStructuresApi";
import "../styles/rentStructures.css";

const money = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });
type ViewKey = "control" | "configuracion";

function formatAmount(amount: number | null) {
  return amount === null ? "—" : `$ ${money.format(amount)}`;
}

function ConceptIcon({ type }: { type: string }) {
  const symbol = type === "legal_discount" ? "−" : type === "no_imponible" ? "◇" : "+";
  return <span className={`rent-concept-icon rent-concept-icon-${type}`} aria-hidden="true">{symbol}</span>;
}

function StructureSection({ title, code, lines, total }: { title: string; code: string; lines: RentStructureLine[]; total: number | null }) {
  const sectionLines = lines.filter((line) => line.sectionCode === code);
  return (
    <section className="rent-structure-section" aria-label={title}>
      <div className="rent-section-heading"><span>{title}</span><strong>{formatAmount(total)}</strong></div>
      {sectionLines.length ? sectionLines.map((line) => (
        <div className="rent-line" key={line.id}>
          <div className="rent-line-label"><ConceptIcon type={line.conceptType} /><span>{line.conceptName}{line.detail ? <small>{line.detail}</small> : null}</span></div>
          <strong>{formatAmount(line.amount)}</strong>
        </div>
      )) : <div className="rent-section-empty">Sin conceptos configurados.</div>}
    </section>
  );
}

function ConfigEditor({ authorizedHeadcount, lines, legal, catalog, onHeadcountChange, onLinesChange, onLegalChange, onSave, isSaving }: {
  authorizedHeadcount: number;
  lines: RentStructureConfigLine[];
  legal: RentStructureLegalConfig;
  catalog: RentLegalCatalog;
  onHeadcountChange: (value: number) => void;
  onLinesChange: (lines: RentStructureConfigLine[]) => void;
  onLegalChange: (legal: RentStructureLegalConfig) => void;
  onSave: () => void;
  isSaving: boolean;
}) {
  const addLine = (sectionCode: "imponible" | "no_imponible") => onLinesChange([...lines, { conceptCode: `concepto_${lines.length + 1}`, conceptName: "Nuevo concepto", sectionCode, amount: 0, sortOrder: lines.length * 10 + 10 }]);
  const updateLine = (index: number, patch: Partial<RentStructureConfigLine>) => onLinesChange(lines.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line));
  const isIsapre = legal.healthMode !== "fonasa";
  const planUnit = legal.healthMode === "isapre_uf" ? "UF" : legal.healthMode === "isapre_percentage" ? "%" : "$";

  return (
    <div className="rent-config-editor">
      <div className="rent-config-topline">
        <label><span>Cupos autorizados</span><input type="number" min="0" step="1" value={authorizedHeadcount} onChange={(event) => onHeadcountChange(Math.max(0, Number(event.target.value) || 0))} /></label>
        <button className="rent-primary-button" type="button" onClick={onSave} disabled={isSaving}>{isSaving ? "Guardando…" : "Guardar configuración"}</button>
      </div>

      <section className="rent-legal-config" aria-label="Parámetros previsionales del cargo">
        <div className="rent-legal-config-heading">
          <div><span>Descuentos legales</span><strong>Se calculan automáticamente sobre el total imponible configurado</strong></div>
          <small>Parámetros legales vigentes</small>
        </div>
        <div className="rent-legal-fields">
          <label>
            <span>AFP de referencia</span>
            <select value={legal.afpCode} onChange={(event) => onLegalChange({ ...legal, afpCode: event.target.value })}>
              {catalog.afps.map((afp) => <option key={afp.code} value={afp.code}>{afp.name} · {(10 + afp.commissionRate * 100).toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% total</option>)}
            </select>
          </label>
          <label>
            <span>Salud</span>
            <select value={legal.healthMode} onChange={(event) => {
              const healthMode = event.target.value as RentStructureLegalConfig["healthMode"];
              onLegalChange({ ...legal, healthMode, healthProviderName: healthMode === "fonasa" ? "Fonasa" : legal.healthProviderName === "Fonasa" ? "Isapre" : legal.healthProviderName, healthPlanValue: healthMode === "fonasa" ? 0 : legal.healthPlanValue });
            }}>
              <option value="fonasa">Fonasa · 7%</option>
              <option value="isapre_uf">Isapre · plan en UF</option>
              <option value="isapre_pesos">Isapre · plan en pesos</option>
              <option value="isapre_percentage">Isapre · plan porcentual</option>
            </select>
          </label>
          {isIsapre ? <label><span>Institución</span><input value={legal.healthProviderName} onChange={(event) => onLegalChange({ ...legal, healthProviderName: event.target.value })} placeholder="Nombre de Isapre" /></label> : null}
          {isIsapre ? <label><span>Valor plan ({planUnit})</span><input type="number" min="0" step={legal.healthMode === "isapre_uf" ? "0.001" : legal.healthMode === "isapre_percentage" ? "0.01" : "1"} value={legal.healthPlanValue} onChange={(event) => onLegalChange({ ...legal, healthPlanValue: Math.max(0, Number(event.target.value) || 0) })} /></label> : null}
          <label><span>Tipo de contrato</span><select value={legal.unemploymentContractType} onChange={(event) => onLegalChange({ ...legal, unemploymentContractType: event.target.value as RentStructureLegalConfig["unemploymentContractType"] })}><option value="indefinite">Indefinido · trabajador 0,6%</option><option value="fixed_term">Plazo fijo u obra · trabajador 0%</option></select></label>
        </div>
      </section>

      {(["imponible", "no_imponible"] as const).map((sectionCode) => (
        <section className="rent-config-section" key={sectionCode}>
          <div className="rent-section-heading"><span>{sectionCode === "imponible" ? "Haberes imponibles" : "Haberes no imponibles"}</span><button className="rent-link-button" type="button" onClick={() => addLine(sectionCode)}>+ Agregar concepto</button></div>
          {lines.map((line, index) => line.sectionCode === sectionCode ? <div className="rent-config-row" key={`${line.conceptCode}-${index}`}><input aria-label="Nombre del concepto" value={line.conceptName} onChange={(event) => updateLine(index, { conceptName: event.target.value })} /><input aria-label="Monto del concepto" type="number" min="0" step="1" value={line.amount} onChange={(event) => updateLine(index, { amount: Math.max(0, Number(event.target.value) || 0) })} /><button className="rent-remove-button" type="button" aria-label={`Eliminar ${line.conceptName}`} onClick={() => onLinesChange(lines.filter((_, lineIndex) => lineIndex !== index))}>×</button></div> : null)}
          {!lines.some((line) => line.sectionCode === sectionCode) ? <div className="rent-section-empty">Agrega los conceptos que componen esta sección.</div> : null}
        </section>
      ))}
      <p className="rent-config-note">El sistema suma los haberes imponibles definidos para el cargo y aplica sobre esa base AFP, salud y seguro de cesantía. Los topes y tasas legales se actualizan centralmente, sin convertir esta vista en una liquidación mensual.</p>
    </div>
  );
}

export function RentStructuresPage() {
  const [view, setView] = useState<ViewKey>("control");
  const [contractId, setContractId] = useState<number | null>(null);
  const [jobPositionId, setJobPositionId] = useState<number | null>(null);
  const [authorizedHeadcount, setAuthorizedHeadcount] = useState(0);
  const [configLines, setConfigLines] = useState<RentStructureConfigLine[]>([]);
  const [legalConfig, setLegalConfig] = useState<RentStructureLegalConfig>({ afpCode: "habitat", healthMode: "fonasa", healthProviderName: "Fonasa", healthPlanValue: 0, unemploymentContractType: "indefinite" });
  const query = useRentStructureControl(contractId, jobPositionId);
  const saveMutation = useSaveRentStructureConfig(contractId, jobPositionId);
  const contracts = query.data?.contracts ?? [];
  const positions = query.data?.positions ?? [];
  const selectedPosition = useMemo(() => positions.find((position) => position.id === jobPositionId) ?? null, [jobPositionId, positions]);
  const detail = query.data?.structure ?? null;

  useEffect(() => {
    if (!contractId && contracts.length) {
      const codelcoDsal = contracts.find((contract) => {
        const label = `${contract.contractName} ${contract.code}`.toLocaleLowerCase("es-CL");
        return label.includes("codelco") && label.includes("dsal");
      });
      setContractId((codelcoDsal ?? contracts[0]).id);
    }
  }, [contractId, contracts]);
  useEffect(() => { if (jobPositionId && !positions.some((position) => position.id === jobPositionId)) setJobPositionId(null); }, [jobPositionId, positions]);
  useEffect(() => {
    setAuthorizedHeadcount(detail?.authorizedHeadcount ?? selectedPosition?.authorizedHeadcount ?? 0);
    setConfigLines((detail?.lines ?? []).filter((line) => line.sectionCode === "imponible" || line.sectionCode === "no_imponible").map((line) => ({ conceptCode: line.conceptCode, conceptName: line.conceptName, sectionCode: line.sectionCode as "imponible" | "no_imponible", amount: line.amount, sortOrder: line.sortOrder })));
    setLegalConfig(detail ? { afpCode: detail.legalScenario.afpCode, healthMode: detail.legalScenario.healthMode, healthProviderName: detail.legalScenario.healthProviderName, healthPlanValue: detail.legalScenario.healthPlanValue, unemploymentContractType: detail.legalScenario.unemploymentContractType } : { afpCode: "habitat", healthMode: "fonasa", healthProviderName: "Fonasa", healthPlanValue: 0, unemploymentContractType: "indefinite" });
  }, [detail, selectedPosition]);

  const save = () => saveMutation.mutate({ authorizedHeadcount, lines: configLines, legal: legalConfig });
  const legalLines = detail?.lines.filter((line) => line.sectionCode === "legal_discount") ?? [];

  return (
    <PageShell className="rent-structures-page">
      <header className="minimal-page-header rent-page-header"><div><span className="rent-eyebrow">Recursos Humanos · Control gerencial</span><h1>Control Estructuras de Renta</h1></div><p className="description rent-page-description">Define la renta permanente por cargo y estima sus descuentos legales.</p></header>
      <nav className="rent-tab-shell" aria-label="Secciones de estructuras de renta"><div className="approval-chip-row rent-view-tabs"><button type="button" className={`approval-chip ${view === "control" ? "tracking-kpi-card-active" : ""}`} onClick={() => setView("control")}>Control</button>{query.data?.canConfigure ? <button type="button" className={`approval-chip ${view === "configuracion" ? "tracking-kpi-card-active" : ""}`} onClick={() => setView("configuracion")}>Configuración</button> : null}</div></nav>
      {query.isError ? <div className="rent-feedback rent-feedback-error">No fue posible cargar la información. Intenta nuevamente.</div> : null}
      {saveMutation.isError ? <div className="rent-feedback rent-feedback-error">{(saveMutation.error as Error).message}</div> : null}

      <section className="rent-selector-panel" aria-label="Selección de contrato">
        <label><span>Contrato</span><select value={contractId ?? ""} onChange={(event) => { setContractId(Number(event.target.value) || null); setJobPositionId(null); }} disabled={query.isLoading && !contracts.length}><option value="">Seleccione un contrato</option>{contracts.map((contract) => <option value={contract.id} key={contract.id}>{contract.contractName}</option>)}</select></label>
        <div className="rent-selector-meta">{contractId ? `${positions.length} cargos asociados` : "Catálogo inicial: Codelco DSAL"}</div>
      </section>

      <section className="rent-workspace">
        <aside className="rent-position-panel">
          <div className="rent-panel-heading"><div><span>Contrato seleccionado</span><h2>Cargos asociados</h2></div><b>{positions.length}</b></div>
          {!contractId ? <div className="rent-empty-panel">Selecciona un contrato para ver sus cargos.</div> : null}
          {contractId && query.isFetching && !positions.length ? <div className="rent-skeleton-list" aria-label="Cargando cargos"><i /><i /><i /></div> : null}
          <div className="rent-position-list">{positions.map((position) => <button type="button" className={`rent-position-item ${position.id === jobPositionId ? "is-active" : ""}`} key={position.id} onClick={() => setJobPositionId(position.id)}><span><strong>{position.name}</strong><small>{position.code}</small></span><span className={`rent-position-status ${position.hasStructure ? "is-ready" : ""}`}>{position.hasStructure ? "Definida" : "Pendiente"}</span></button>)}</div>
        </aside>

        <section className="rent-detail-panel">
          <div className="rent-panel-heading"><div><span>{view === "control" ? "Estructura vigente" : "Mantenedor de renta"}</span><h2>{selectedPosition?.name ?? "Selecciona un cargo"}</h2></div></div>
          {!selectedPosition ? <div className="rent-empty-panel">Elige un cargo a la izquierda para revisar o configurar sus conceptos.</div> : null}
          {selectedPosition && view === "control" ? <>
            {query.isFetching ? <div className="rent-skeleton-lines"><i /><i /><i /><i /></div> : detail ? <>
              <div className="rent-legal-context"><span>{detail.authorizedHeadcount} cupos autorizados</span><span>{detail.legalScenario.afpName}</span><span>{detail.legalScenario.healthMode === "fonasa" ? "Fonasa" : detail.legalScenario.healthProviderName}</span><span>{detail.legalScenario.unemploymentContractType === "indefinite" ? "Contrato indefinido" : "Plazo fijo u obra"}</span></div>
              {!detail.calculationAvailable ? <div className="rent-feedback rent-feedback-error">No existen parámetros legales vigentes para calcular la estimación.</div> : null}
              <div className="rent-pay-slip">
                <div className="rent-pay-slip-columns">
                  <div><StructureSection title="Haberes imponibles" code="imponible" lines={detail.lines} total={detail.totals.imponible} /><StructureSection title="Haberes no imponibles" code="no_imponible" lines={detail.lines} total={detail.totals.noImponible} /><div className="rent-column-total"><span>Total haberes</span><strong>{formatAmount(detail.totals.haberes)}</strong></div></div>
                  <div><StructureSection title="Descuentos legales" code="legal_discount" lines={legalLines} total={detail.totals.legalDiscounts} /><div className="rent-column-total rent-column-total-discount"><span>Total descuentos</span><strong>{formatAmount(detail.totals.legalDiscounts)}</strong></div></div>
                </div>
                <div className="rent-base-strip"><span>Base AFP / salud <strong>{formatAmount(detail.totals.pensionHealthBase)}</strong></span><span>Base cesantía <strong>{formatAmount(detail.totals.unemploymentBase)}</strong></span><span>Masa autorizada <strong>{formatAmount(detail.totals.authorizedPayroll)}</strong></span></div>
                <div className="rent-liquid-total"><span>Líquido estimado por cargo</span><strong>{formatAmount(detail.totals.liquidoEstimated)}</strong></div>
              </div>
              <p className="rent-detail-footnote">Estimación estructural del cargo. No corresponde a la liquidación de una persona ni incorpora impuestos, APV u otros descuentos individuales.</p>
            </> : <div className="rent-empty-panel">Este cargo aún no tiene una estructura de renta configurada.</div>}
          </> : null}
          {selectedPosition && view === "configuracion" ? <ConfigEditor authorizedHeadcount={authorizedHeadcount} lines={configLines} legal={legalConfig} catalog={query.data?.legalCatalog ?? { afps: [] }} onHeadcountChange={setAuthorizedHeadcount} onLinesChange={setConfigLines} onLegalChange={setLegalConfig} onSave={save} isSaving={saveMutation.isPending} /> : null}
        </section>
      </section>
    </PageShell>
  );
}
