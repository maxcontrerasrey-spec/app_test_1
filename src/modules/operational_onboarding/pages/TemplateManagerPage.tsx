import { useState } from "react";
import { useTemplates, useCreateTemplate } from "../hooks/useTemplateQueries";
import type { OnboardingTemplate } from "../types";

export function TemplateManagerPage() {
  const { data: templates, isLoading } = useTemplates();
  const createTemplateMutation = useCreateTemplate();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleCreate = async () => {
    await createTemplateMutation.mutateAsync({
      name: "Nueva Plantilla " + new Date().getTime(),
      description: "Plantilla generada automáticamente",
      cargo: null,
      area: null,
      contrato: null,
      faena: null,
      division: null,
      centro_costo: null,
      worker_type: null,
      is_active: true
    });
    setIsModalOpen(false);
  };

  return (
    <div className="module-page-layout">
      <header className="module-header">
        <div>
          <h1>Gestión de Plantillas de Alta Operacional</h1>
          <p>Administra las plantillas y tareas por defecto para la habilitación post-contratación.</p>
        </div>
        <div className="header-actions">
          <button className="btn-primary" onClick={handleCreate} disabled={createTemplateMutation.isPending}>
            {createTemplateMutation.isPending ? "Creando..." : "Nueva Plantilla"}
          </button>
        </div>
      </header>

      <div className="module-content">
        {isLoading ? (
          <div>Cargando plantillas...</div>
        ) : templates?.length === 0 ? (
          <div className="empty-state">
            <p>No hay plantillas configuradas.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Cargo / Área</th>
                  <th>Faena / División</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {templates?.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <strong>{t.name}</strong>
                      <div className="text-sm text-gray-500">{t.description}</div>
                    </td>
                    <td>
                      {t.cargo || "-"} / {t.area || "-"}
                    </td>
                    <td>
                      {t.faena || "-"} / {t.division || "-"}
                    </td>
                    <td>
                      <span className={`status-badge ${t.is_active ? "status-aprobada" : "status-rechazada"}`}>
                        {t.is_active ? "Activa" : "Inactiva"}
                      </span>
                    </td>
                    <td>
                      <button className="btn-secondary">Editar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
