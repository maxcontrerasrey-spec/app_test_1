import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTemplates, useCreateTemplate } from "../hooks/useTemplateQueries";

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
      is_active: false,
    });
    // Navegar al builder de inmediato
    navigate(`/alta-operacional/templates?id=${newTpl.id}`);
  };

  if (isLoading) {
    return (
      <section className="info-card">
        <div style={{ padding: "2rem", textAlign: "center" }}>
          <p className="tracking-empty-state">
            Cargando plantillas de alta operacional...
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="info-card">
      <div className="tracking-toolbar">
        <div className="tracking-toolbar-copy">
          <h3>Gestión de Plantillas</h3>
          <span className="tracking-filter-caption">
            Configura los flujos y dependencias de tareas que se asignarán
            automáticamente al aprobar un candidato.
          </span>
        </div>
        <div className="hr-incentives-history-actions">
          <button
            type="button"
            className="soft-primary-button"
            onClick={handleCreate}
            disabled={createTemplateMutation.isPending}
          >
            {createTemplateMutation.isPending
              ? "Creando..."
              : "+ Nueva Plantilla"}
          </button>
        </div>
      </div>

      <div className="tracking-table-container">
        <table className="tracking-table hr-incentives-table">
          <thead>
            <tr>
              <th>Nombre del Workflow</th>
              <th>Cargo Objetivo</th>
              <th>Área / Contrato</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {templates?.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  style={{ textAlign: "center", padding: "2rem" }}
                >
                  <p className="tracking-empty-state">
                    No hay plantillas configuradas.
                  </p>
                </td>
              </tr>
            ) : (
              templates?.map((t) => (
                <tr
                  key={t.id}
                  onClick={() =>
                    navigate(`/alta-operacional/templates?id=${t.id}`)
                  }
                  style={{ cursor: "pointer" }}
                >
                  <td>
                    <strong>{t.name}</strong>
                    <div className="tracking-filter-caption">
                      {t.description || "Sin descripción"}
                    </div>
                  </td>
                  <td>{t.cargo || "-"}</td>
                  <td>
                    {t.area ? `${t.area} ` : ""}
                    {t.contrato ? `(${t.contrato})` : "-"}
                  </td>
                  <td>
                    <strong>{t.is_active ? "Activo" : "Borrador"}</strong>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
