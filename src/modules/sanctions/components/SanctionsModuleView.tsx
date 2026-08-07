import { useState } from "react";
import { useHrSanctionSetupCatalogs } from "../hooks/useSanctionsQueries";
import { SanctionRequestForm } from "./SanctionRequestForm";
import { SanctionsControlView } from "./SanctionsControlView";
import "../styles/sanctions.css";

type SanctionsTab = "request" | "control";

export function SanctionsModuleView() {
  const [activeTab, setActiveTab] = useState<SanctionsTab>("request");
  const setupCatalogsQuery = useHrSanctionSetupCatalogs(true);

  return (
    <div className="sanctions-module">
      <div className="approval-chip-row">
        <button
          type="button"
          className={`approval-chip ${activeTab === "request" ? "tracking-kpi-card-active" : ""}`}
          onClick={() => setActiveTab("request")}
        >
          Nueva solicitud
        </button>
        <button
          type="button"
          className={`approval-chip ${activeTab === "control" ? "tracking-kpi-card-active" : ""}`}
          onClick={() => setActiveTab("control")}
        >
          Control y cierre
        </button>
      </div>

      {activeTab === "request" ? (
        <SanctionRequestForm
          setupCatalogs={setupCatalogsQuery.data}
          isLoadingCatalogs={setupCatalogsQuery.isLoading}
        />
      ) : null}

      {activeTab === "control" ? <SanctionsControlView /> : null}
    </div>
  );
}
