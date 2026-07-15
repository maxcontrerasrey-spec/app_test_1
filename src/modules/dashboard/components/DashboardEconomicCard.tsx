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

const ECONOMIC_INDICATORS_CACHE_KEY = "dashboard:economic-indicators:v1";
const ECONOMIC_INDICATOR_ENDPOINTS = [
  "https://findic.cl/api/",
  "https://mindicador.cl/api"
];
const ECONOMIC_INDICATOR_TIMEOUT_MS = 4_000;

async function fetchJsonWithTimeout(url: string) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), ECONOMIC_INDICATOR_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new Error("Network response was not ok");
    }

    return (await response.json()) as MindicadorResponse;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function readCachedIndicators(): EconomicState | null {
  try {
    const cached = window.localStorage.getItem(ECONOMIC_INDICATORS_CACHE_KEY);
    return cached ? ({ ...JSON.parse(cached), isLoading: false, error: false } as EconomicState) : null;
  } catch {
    return null;
  }
}

function persistIndicators(payload: EconomicState) {
  try {
    window.localStorage.setItem(
      ECONOMIC_INDICATORS_CACHE_KEY,
      JSON.stringify({
        uf: payload.uf,
        utm: payload.utm,
        dolar: payload.dolar,
        ipc: payload.ipc
      })
    );
  } catch {
    // localStorage can be unavailable in private or restricted browser contexts.
  }
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
    const cachedIndicators = readCachedIndicators();

    if (cachedIndicators) {
      setData(cachedIndicators);
    }

    let isMounted = true;

    async function loadIndicators() {
      try {
        let payload: MindicadorResponse | null = null;

        for (const endpoint of ECONOMIC_INDICATOR_ENDPOINTS) {
          try {
            payload = await fetchJsonWithTimeout(endpoint);
            break;
          } catch {
            payload = null;
          }
        }

        if (!payload) {
          throw new Error("No economic indicator provider available");
        }

        const nextState = {
          isLoading: false,
          error: false,
          uf: payload.uf?.valor ?? null,
          utm: payload.utm?.valor ?? null,
          dolar: payload.dolar?.valor ?? null,
          ipc: payload.ipc?.valor ?? null,
        };

        persistIndicators(nextState);

        if (isMounted) {
          setData(nextState);
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }

        if (isMounted) {
          setData((prev) => ({ ...prev, isLoading: false, error: !cachedIndicators }));
        }
      }
    }

    void loadIndicators();

    return () => {
      isMounted = false;
    };
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
