import { useEffect, useState } from "react";
import { formatCurrencyValue, formatPercentValue } from "../../../shared/lib/format";
import { SoftSurface } from "../../../shared/ui";

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
    <SoftSurface
      as="article"
      className="dashboard-info-card dashboard-info-card-economics"
      variant="raised"
    >
      <div className="dashboard-economics-grid">
        <div className="dashboard-economic-item">
          <span className="dashboard-economic-label">UF</span>
          <span className="dashboard-economic-value">
            {data.isLoading
              ? "..."
              : formatCurrencyValue(data.uf, {
                  fallback: "--",
                  minimumFractionDigits: data.uf && data.uf % 1 !== 0 ? 2 : 0,
                  maximumFractionDigits: data.uf && data.uf % 1 !== 0 ? 2 : 0
                })}
          </span>
        </div>
        
        <div className="dashboard-economic-item">
          <span className="dashboard-economic-label">Dólar Obs.</span>
          <span className="dashboard-economic-value">
            {data.isLoading
              ? "..."
              : formatCurrencyValue(data.dolar, {
                  fallback: "--",
                  minimumFractionDigits: data.dolar && data.dolar % 1 !== 0 ? 2 : 0,
                  maximumFractionDigits: data.dolar && data.dolar % 1 !== 0 ? 2 : 0
                })}
          </span>
        </div>

        <div className="dashboard-economic-item">
          <span className="dashboard-economic-label">UTM</span>
          <span className="dashboard-economic-value">
            {data.isLoading
              ? "..."
              : formatCurrencyValue(data.utm, {
                  fallback: "--",
                  minimumFractionDigits: data.utm && data.utm % 1 !== 0 ? 2 : 0,
                  maximumFractionDigits: data.utm && data.utm % 1 !== 0 ? 2 : 0
                })}
          </span>
        </div>

        <div className="dashboard-economic-item">
          <span className="dashboard-economic-label">IPC</span>
          <span className="dashboard-economic-value">
            {data.isLoading ? "..." : formatPercentValue(data.ipc, 1, "--")}
          </span>
        </div>
      </div>
      
      {data.error && (
        <span className="dashboard-economic-error">
          Error al cargar indicadores
        </span>
      )}
    </SoftSurface>
  );
}
