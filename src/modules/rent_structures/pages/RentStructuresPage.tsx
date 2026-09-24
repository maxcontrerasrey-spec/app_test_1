import { useEffect, useMemo, useState } from "react";
import { PageShell } from "../../../shared/ui";
import { useRentStructureControl } from "../hooks/useRentStructuresQueries";
import type { RentStructureLine } from "../services/rentStructuresApi";
import "../styles/rentStructures.css";

const money = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });

function ConceptIcon({ type }: { type: string }) {
  const symbol = type.includes("total") ? "Σ" : type === "liquido" ? "$" : type === "no_imponible" ? "◇" : "＋";
  return <span className={`rent-concept-icon rent-concept-icon-${type}`} aria-hidden="true">{symbol}</span>;
}

function formatAmount(amount: number | null) {
  return amount === null ? "—" : `$ ${money.format(amount)}`;
}

function StructureLines({ lines }: { lines: RentStructureLine[] }) {
  if (!lines.length) {
    return <div className="rent-empty-panel">Este cargo aún no tiene una estructura de renta configurada.</div>;
  }

  return (
    <div className="rent-lines" role="table" aria-label="Estructura de renta">
      {lines.map((line) => (
        <div className={`rent-line rent-line-${line.conceptType}`} key={line.id} role="row">
          <div className="rent-line-label" role="cell"><ConceptIcon type={line.conceptType} />{line.conceptName}</div>
          <strong role="cell">{formatAmount(line.amount)}</strong>
        </div>
      ))}
    </div>
  );
}

export function RentStructuresPage() {
  const [contractId, setContractId] = useState<number | null>(null);
  const [jobPositionId, setJobPositionId] = useState<number | null>(null);
  const query = useRentStructureControl(contractId, jobPositionId);
  const contracts = query.data?.contracts ?? [];
  const positions = query.data?.positions ?? [];
  const selectedPosition = useMemo(
    () => positions.find((position) => position.id === jobPositionId) ?? null,
    [jobPositionId, positions]
  );

  useEffect(() => {
    if (!contractId && contracts.length) {
      const dsal = contracts.find((contract) => `${contract.contractName} ${contract.code}`.toLocaleLowerCase("es-CL").includes("dsal"));
      setContractId((dsal ?? contracts[0]).id);
    }
  }, [contractId, contracts]);

  useEffect(() => {
    if (jobPositionId && !positions.some((position) => position.id === jobPositionId)) setJobPositionId(null);
  }, [jobPositionId, positions]);

  return (
    <PageShell className="rent-structures-page">
      <header className="rent-page-header">
        <div>
          <span className="rent-eyebrow">Recursos Humanos · Control gerencial</span>
          <h1>Control Estructuras de Renta</h1>
          <p>Consulta la renta definida y el presupuesto mensual por cargo habilitado en BUK.</p>
        </div>
        <div className="rent-security-note">Vista reservada para gerencia y dirección</div>
      </header>

      {query.isError ? <div className="rent-feedback rent-feedback-error">{(query.error as Error).message}</div> : null}

      <section className="rent-selector-panel" aria-label="Selección de contrato y cargo">
        <label>
          <span>Contrato BUK</span>
          <select value={contractId ?? ""} onChange={(event) => { setContractId(Number(event.target.value) || null); setJobPositionId(null); }} disabled={query.isLoading && !contracts.length}>
            <option value="">Seleccione un contrato</option>
            {contracts.map((contract) => <option value={contract.id} key={contract.id}>{contract.contractName}</option>)}
          </select>
        </label>
        <div className="rent-selector-meta">{contractId ? `${positions.length} cargos habilitados por BUK` : "Partimos con el catálogo de Codelco DSAL"}</div>
      </section>

      <section className="rent-workspace">
        <aside className="rent-position-panel">
          <div className="rent-panel-heading"><div><span>Catálogo BUK</span><h2>Cargos habilitados</h2></div><b>{positions.length}</b></div>
          {!contractId ? <div className="rent-empty-panel">Selecciona un contrato para ver sus cargos.</div> : null}
          {contractId && query.isFetching && !positions.length ? <div className="rent-skeleton-list" aria-label="Cargando cargos"><i /><i /><i /></div> : null}
          <div className="rent-position-list">
            {positions.map((position) => (
              <button type="button" className={`rent-position-item ${position.id === jobPositionId ? "is-active" : ""}`} key={position.id} onClick={() => setJobPositionId(position.id)}>
                <span><strong>{position.name}</strong><small>{position.code}</small></span>
                <span className={`rent-position-status ${position.hasStructure ? "is-ready" : ""}`}>{position.hasStructure ? "Definida" : "Pendiente"}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="rent-detail-panel">
          <div className="rent-panel-heading"><div><span>Estructura vigente</span><h2>{selectedPosition?.name ?? "Selecciona un cargo"}</h2></div></div>
          {selectedPosition ? <div className="rent-budget-strip"><span>Presupuesto mensual por cargo</span><strong>{formatAmount(query.data?.structure?.monthlyBudget ?? selectedPosition.monthlyBudget)}</strong></div> : null}
          {!selectedPosition ? <div className="rent-empty-panel">Elige un cargo a la izquierda para revisar sus conceptos.</div> : null}
          {selectedPosition && query.isFetching ? <div className="rent-skeleton-lines"><i /><i /><i /><i /></div> : null}
          {selectedPosition && !query.isFetching ? <StructureLines lines={query.data?.structure?.lines ?? []} /> : null}
          {selectedPosition && !query.isFetching && !query.data?.structure ? <div className="rent-detail-footnote">La estructura está pendiente de parametrización; no se muestran montos estimados.</div> : null}
        </section>
      </section>
    </PageShell>
  );
}
