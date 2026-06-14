import { useState } from "react";
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

  const activeTemplates = templates?.filter((t) => t.is_active) || [];

  const handleStart = async () => {
    if (!selectedCandidate || !selectedTemplate) {
      alert("Por favor selecciona un candidato y una plantilla");
      return;
    }

    try {
      await startMutation.mutateAsync({
        candidateId: selectedCandidate,
        templateId: selectedTemplate,
      });
      onClose();
    } catch (error: any) {
      alert("Error al iniciar el caso: " + error.message);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
    >
      <div
        className="info-card"
        style={{
          width: "100%",
          maxWidth: "500px",
          padding: "2rem",
          background: "var(--surface-color)",
        }}
      >
        <h3 style={{ margin: "0 0 1.5rem" }}>Iniciar Alta Operacional</h3>

        <div style={{ marginBottom: "1rem" }}>
          <label
            style={{
              display: "block",
              marginBottom: "0.5rem",
              fontWeight: 600,
              fontSize: "0.9rem",
            }}
          >
            Seleccionar Candidato
          </label>
          <select
            className="search-input"
            style={{ width: "100%", padding: "0.5rem" }}
            value={selectedCandidate}
            onChange={(e) => setSelectedCandidate(e.target.value)}
            disabled={candidatesLoading}
          >
            <option value="">-- Seleccione Candidato --</option>
            {candidates?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name} ({c.national_id || "Sin RUT"})
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: "2rem" }}>
          <label
            style={{
              display: "block",
              marginBottom: "0.5rem",
              fontWeight: 600,
              fontSize: "0.9rem",
            }}
          >
            Plantilla de Workflow
          </label>
          <select
            className="search-input"
            style={{ width: "100%", padding: "0.5rem" }}
            value={selectedTemplate}
            onChange={(e) => setSelectedTemplate(e.target.value)}
            disabled={templatesLoading}
          >
            <option value="">-- Seleccione Plantilla --</option>
            {activeTemplates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

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
            disabled={startMutation.isPending}
          >
            {startMutation.isPending ? "Iniciando..." : "Confirmar e Iniciar"}
          </button>
        </div>
      </div>
    </div>
  );
}
