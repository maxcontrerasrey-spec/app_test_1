import { useEffect, useState } from "react";

type MindicadorResponse = {
  version: string;
  autor: string;
  fecha: string;
  uf: { valor: number };
  utm: { valor: number };
  dolar: { valor: number };
  ipc: { valor: number };
};

type EconomicState = {
  isLoading: boolean;
  error: boolean;
  uf: number | null;
  utm: number | null;
  dolar: number | null;
  ipc: number | null;
};

function formatCurrency(value: number | null) {
  if (value === null) return "--";
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: value % 1 !== 0 ? 2 : 0,
  }).format(value);
}

function formatPercent(value: number | null) {
  if (value === null) return "--";
  return `${value.toFixed(1)}%`;
}

export function DashboardEconomicCard() {
  const [data, setData] = useState<EconomicState>({
    isLoading: true,
    error: false,
    uf: null,
    utm: null,
    dolar: null,
    ipc: null,
  });

  useEffect(() => {
    const controller = new AbortController();

    async function loadIndicators() {
      try {
        const response = await fetch("https://mindicador.cl/api", {
          signal: controller.signal,
        });
        
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }

        const payload: MindicadorResponse = await response.json();
        
        setData({
          isLoading: false,
          error: false,
          uf: payload.uf?.valor ?? null,
          utm: payload.utm?.valor ?? null,
          dolar: payload.dolar?.valor ?? null,
          ipc: payload.ipc?.valor ?? null,
        });
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setData((prev) => ({ ...prev, isLoading: false, error: true }));
      }
    }

    void loadIndicators();

    return () => controller.abort();
  }, []);

  return (
    <article className="dashboard-info-card dashboard-info-card-economics">
      <div className="dashboard-economic-card-header">
        <div className="dashboard-info-head">
          <span className="dashboard-info-kicker">Mindicador.cl</span>
          <strong>Indicadores Oficiales</strong>
        </div>
        <svg className="dashboard-economic-card-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2v20" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      </div>

      <div className="dashboard-economics-grid">
        <div className="dashboard-economic-item">
          <span className="dashboard-economic-label">UF</span>
          <span className="dashboard-economic-value">
            {data.isLoading ? "..." : formatCurrency(data.uf)}
          </span>
        </div>
        
        <div className="dashboard-economic-item">
          <span className="dashboard-economic-label">Dólar Obs.</span>
          <span className="dashboard-economic-value">
            {data.isLoading ? "..." : formatCurrency(data.dolar)}
          </span>
        </div>

        <div className="dashboard-economic-item">
          <span className="dashboard-economic-label">UTM</span>
          <span className="dashboard-economic-value">
            {data.isLoading ? "..." : formatCurrency(data.utm)}
          </span>
        </div>

        <div className="dashboard-economic-item">
          <span className="dashboard-economic-label">IPC</span>
          <span className="dashboard-economic-value">
            {data.isLoading ? "..." : formatPercent(data.ipc)}
          </span>
        </div>
      </div>
      
      {data.error && (
        <span className="dashboard-economic-error">
          Error al cargar indicadores
        </span>
      )}
    </article>
  );
}
