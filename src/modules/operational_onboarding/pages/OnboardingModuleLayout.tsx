import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../auth/context/AuthContext";
import { PageShell } from "../../../shared/ui/layout/PageShell";
import { PeopleTab } from "../components/tabs/PeopleTab";
import { TemplatesTab } from "../components/tabs/TemplatesTab";
import { TasksTab } from "../components/tabs/TasksTab";
import { SequencesTab } from "../components/tabs/SequencesTab";

type TabId = "people" | "templates" | "sequences" | "tasks";

export function OnboardingModuleLayout() {
  const { tab } = useParams();
  const navigate = useNavigate();
  const { accessibleModules, isSuperAdmin } = useAuth();

  const isAdmin =
    isSuperAdmin || accessibleModules.includes("alta_operacional_personal");
  const requestedTab = (tab as TabId) || "people";
  const activeTab: TabId =
    requestedTab === "templates" && !isAdmin ? "people" : requestedTab;

  useEffect(() => {
    if (requestedTab === "templates" && !isAdmin) {
      navigate("/alta-operacional/people", { replace: true });
    }
  }, [isAdmin, navigate, requestedTab]);

  const handleTabChange = (newTab: TabId) => {
    navigate(`/alta-operacional/${newTab}`);
  };

  return (
    <PageShell>
      <div className="minimal-page-header">
        <h1>Alta Operacional</h1>
      </div>

      <section className="tracking-panel">
        <div className="approval-chip-row">
          <button
            type="button"
            className={`approval-chip ${activeTab === "people" ? "tracking-kpi-card-active" : ""}`}
            onClick={() => handleTabChange("people")}
          >
            Personas en Proceso
          </button>

          {isAdmin && (
            <button
              type="button"
              className={`approval-chip ${activeTab === "templates" ? "tracking-kpi-card-active" : ""}`}
              onClick={() => handleTabChange("templates")}
            >
              Configuración y Plantillas
            </button>
          )}

          <button
            type="button"
            className={`approval-chip ${activeTab === "sequences" ? "tracking-kpi-card-active" : ""}`}
            onClick={() => handleTabChange("sequences")}
          >
            Secuencias
          </button>

          <button
            type="button"
            className={`approval-chip ${activeTab === "tasks" ? "tracking-kpi-card-active" : ""}`}
            onClick={() => handleTabChange("tasks")}
          >
            Tareas
          </button>
        </div>

        {activeTab === "people" && <PeopleTab />}
        {activeTab === "templates" && <TemplatesTab />}
        {activeTab === "sequences" && <SequencesTab />}
        {activeTab === "tasks" && <TasksTab />}
      </section>
    </PageShell>
  );
}
