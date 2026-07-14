import { useState } from "react";
import { SelectField } from "../../../../shared/ui";
import { useTemplates } from "../../hooks/useTemplateQueries";
import { useCandidateProfiles } from "../../hooks/useCandidateProfiles";
import { useStartOnboardingCase } from "../../hooks/useStartOnboardingCase";

interface StartOnboardingModalProps {
  onClose: () => void;
}

export function StartOnboardingModal({ onClose }: StartOnboardingModalProps) {
  const { data: templates, isLoading: templatesLoading } = useTemplates();
  const { data: candidates, isLoading: candidatesLoading } =
    useCandidateProfiles();
  const startMutation = useStartOnboardingCase();

  const [selectedCandidate, setSelectedCandidate] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const activeTemplates = templates?.filter((t) => t.is_active) || [];

  const handleStart = async () => {
    if (!selectedCandidate || !selectedTemplate) {
      setErrorMessage("Selecciona un candidato y una plantilla antes de iniciar el caso.");
      return;
    }

    setErrorMessage(null);

    try {
      await startMutation.mutateAsync({
        candidateId: selectedCandidate,
        templateId: selectedTemplate,
      });
      onClose();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No fue posible iniciar el caso operacional.",
      );
    }
  };

  return (
    <div
      className="approval-modal-backdrop"
      role="presentation"
      onClick={onClose}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        className="approval-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="start-onboarding-modal-title"
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "500px",
          padding: "2rem",
          background: "var(--surface-color)",
        }}
      >
        <h3 id="start-onboarding-modal-title" style={{ margin: "0 0 0.5rem" }}>
          Iniciar Alta Operacional
        </h3>
        <p className="tracking-filter-caption" style={{ marginBottom: "1.5rem" }}>
          Se creará el caso y se copiarán automáticamente las tareas activas de la plantilla.
        </p>

        <div style={{ marginBottom: "1rem" }}>
          <SelectField
            id="start-onboarding-candidate"
            label="Seleccionar Candidato"
            value={selectedCandidate}
            onChange={(event) => setSelectedCandidate(event.target.value)}
            disabled={candidatesLoading}
            placeholder="Seleccione candidato"
            options={(candidates ?? []).map((candidate) => ({
              value: candidate.id,
              label: `${candidate.full_name} (${candidate.national_id || "Sin RUT"})`
            }))}
          />
        </div>

        <div style={{ marginBottom: "2rem" }}>
          <SelectField
            id="start-onboarding-template"
            label="Plantilla de Workflow"
            value={selectedTemplate}
            onChange={(event) => setSelectedTemplate(event.target.value)}
            disabled={templatesLoading}
            placeholder="Seleccione plantilla"
            options={activeTemplates.map((template) => ({
              value: template.id,
              label: template.name
            }))}
          />
        </div>

        {errorMessage ? <p className="form-status form-status-error">{errorMessage}</p> : null}

        <div
          style={{ display: "flex", justifyContent: "flex-end", gap: "1rem" }}
        >
          <button
            type="button"
            className="soft-primary-button"
            style={{ background: "transparent", color: "var(--text-color)" }}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="soft-primary-button"
            onClick={handleStart}
            disabled={
              startMutation.isPending ||
              candidatesLoading ||
              templatesLoading ||
              !selectedCandidate ||
              !selectedTemplate
            }
          >
            {startMutation.isPending ? "Iniciando..." : "Confirmar e Iniciar"}
          </button>
        </div>
      </div>
    </div>
  );
}
