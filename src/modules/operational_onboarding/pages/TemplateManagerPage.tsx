import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTemplates, useCreateTemplate } from "../hooks/useTemplateQueries";
import "../styles/onboarding.css";

export function TemplateManagerPage() {
  const { data: templates, isLoading } = useTemplates();
  const createTemplateMutation = useCreateTemplate();
  const navigate = useNavigate();

  const handleCreate = async () => {
    const newTpl = await createTemplateMutation.mutateAsync({
      name: "Nueva Plantilla de Alta",
      description: "Define el rol y las áreas involucradas.",
      cargo: null,
      area: null,
      contrato: null,
      faena: null,
      division: null,
      centro_costo: null,
      worker_type: null,
      is_active: false
    });
    // Navegar al builder de inmediato
    navigate(`/alta-operacional/plantillas/${newTpl.id}`);
  };

  return (
    <div className="module-page-layout">
      <header className="module-header">
        <div>
          <h1>Gestión de Workflows (Alta Operacional)</h1>
          <p>Configura los procesos de habilitación post-contratación agrupados por cargo.</p>
        </div>
        <div className="header-actions">
          <button className="btn-primary" onClick={handleCreate} disabled={createTemplateMutation.isPending}>
            {createTemplateMutation.isPending ? "Creando..." : "+ Nuevo Workflow"}
          </button>
        </div>
      </header>

      <div className="module-content">
        {isLoading ? (
          <div>Cargando plantillas...</div>
        ) : templates?.length === 0 ? (
          <div className="empty-state">
            <p>No hay workflows configurados. Crea el primero para empezar.</p>
          </div>
        ) : (
          <div className="workflow-gallery">
            {templates?.map((t) => (
              <div
                key={t.id}
                className="workflow-card"
                onClick={() => navigate(`/alta-operacional/plantillas/${t.id}`)}
              >
                <div className="workflow-card-header">
                  <h3>{t.name}</h3>
                  <span className={`status-badge ${t.is_active ? "status-aprobada" : "status-rechazada"}`}>
                    {t.is_active ? "Activo" : "Borrador"}
                  </span>
                </div>

                <div className="workflow-card-body">
                  <p className="workflow-card-desc">
                    {t.description || "Sin descripción proporcionada."}
                  </p>

                  <div className="workflow-card-meta">
                    {t.cargo && <span className="meta-badge">💼 {t.cargo}</span>}
                    {t.area && <span className="meta-badge">🏢 {t.area}</span>}
                    {t.faena && <span className="meta-badge">📍 {t.faena}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
