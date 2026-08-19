import { useEffect, useRef, useState } from "react";
import type { PsychAIOutput, PsychAIReviewDetail } from "../types";

type Props = {
  detail: PsychAIReviewDetail;
  busy?: boolean;
  onClose: () => void;
  onSave: (output: PsychAIOutput, comment: string) => Promise<void>;
  onValidate: (output: PsychAIOutput, comment: string) => Promise<void>;
  onObserve: (output: PsychAIOutput, comment: string) => Promise<void>;
};

function list(items?: string[]) {
  return Array.isArray(items) ? items.filter(Boolean) : [];
}

const FINAL_RECOMMENDATIONS: Array<{
  value: NonNullable<PsychAIOutput["recommendation"]>;
  label: string;
}> = [
  { value: "ADECUADO", label: "Adecuado" },
  { value: "ADECUADO_CON_OBSERVACIONES", label: "Adecuado con Observaciones" },
  { value: "NO_ADECUADO", label: "No Adecuado" },
];

function recommendationLabel(value?: string) {
  return FINAL_RECOMMENDATIONS.find((item) => item.value === value)?.label ?? "Sin selección";
}

function normalizeRecommendation(value?: string): NonNullable<PsychAIOutput["recommendation"]> {
  return FINAL_RECOMMENDATIONS.some((item) => item.value === value)
    ? value as NonNullable<PsychAIOutput["recommendation"]>
    : "ADECUADO_CON_OBSERVACIONES";
}

function isConductorPosition(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-CL")
    .includes("conductor");
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="psych-ai-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function renderOutput(
  output: PsychAIOutput | null,
  selectedRecommendation: NonNullable<PsychAIOutput["recommendation"]> | undefined,
  onRecommendationChange: (value: NonNullable<PsychAIOutput["recommendation"]>) => void,
) {
  if (!output) return <p className="psych-result-note">Sin interpretación disponible.</p>;
  return (
    <div className="psych-ai-output">
      <Section title="Resultado de evaluación">
        <div className="psych-ai-recommendation-card" role="radiogroup" aria-label="Categoría final del informe">
          <div className="psych-ai-recommendation-options">
            {FINAL_RECOMMENDATIONS.map((item) => (
              <button
                key={item.value}
                type="button"
                role="radio"
                aria-checked={selectedRecommendation === item.value}
                className={`psych-ai-recommendation-option ${selectedRecommendation === item.value ? "is-selected" : ""}`}
                onClick={() => onRecommendationChange(item.value)}
              >
                <span className="psych-ai-recommendation-dot" aria-hidden="true" />
                {item.label}
              </button>
            ))}
          </div>
          <small>Selección final de la psicóloga · actual: {recommendationLabel(selectedRecommendation)}</small>
        </div>
        <p>{output.decision_rationale}</p>
      </Section>
      <Section title="Perfil ejecutivo">
        <p>{output.executive_profile ?? output.executive_summary}</p>
      </Section>
      {list(output.critical_strengths).length ? (
        <Section title="Fortalezas críticas">
          <ul>{list(output.critical_strengths).map((item) => <li key={item}>{item}</li>)}</ul>
        </Section>
      ) : null}
      {list(output.critical_gaps).length ? (
        <Section title="Brechas críticas">
          <ul>{list(output.critical_gaps).map((item) => <li key={item}>{item}</li>)}</ul>
        </Section>
      ) : null}
      {list(output.critical_uncertainties).length ? (
        <Section title="Aspectos críticos a profundizar">
          <ul>{list(output.critical_uncertainties).map((item) => <li key={item}>{item}</li>)}</ul>
        </Section>
      ) : null}
      <Section title="Personalidad laboral">
        <p>{output.personality_profile?.summary ?? output.ipip16.summary}</p>
        <p><strong>Autorregulación:</strong> {output.personality_profile?.self_regulation ?? output.ipip16.clusters.self_regulation ?? output.ipip16.clusters.autocontrol_estabilidad}</p>
        <p><strong>Disciplina y estructura:</strong> {output.personality_profile?.discipline_structure ?? output.ipip16.clusters.discipline_structure ?? output.ipip16.clusters.disciplina_estructura}</p>
      </Section>
      <Section title="Estilo interpersonal">
        <p>{output.interpersonal_profile?.summary ?? output.ipc.summary}</p>
        <p>{output.interpersonal_profile?.communication}</p>
        <p className="psych-result-note">{output.ipc.disc_disclaimer}</p>
      </Section>
      <Section title="Seguridad e impulsividad">
        <p>{output.safety_and_impulse_profile?.summary ?? output.bis11.summary}</p>
        <p><strong>BIS-11:</strong> {output.safety_and_impulse_profile?.bis11 ?? output.bis11.impulsivity_interpretation}</p>
        <p><strong>PRP:</strong> {output.safety_and_impulse_profile?.prp ?? output.prp.documentation_status}</p>
      </Section>
      <Section title="Ajuste al cargo">
        <p>{output.job_fit_analysis ?? output.integrated_analysis}</p>
      </Section>
      <Section title="Fortalezas">
        <ul>{list(output.strengths).map((item) => <li key={item}>{item}</li>)}</ul>
      </Section>
      <Section title="Aspectos a profundizar">
        <ul>{list(output.development_areas).map((item) => <li key={item}>{item}</li>)}</ul>
      </Section>
      <Section title="Preguntas sugeridas">
        <ul>{list(output.interview_questions).map((item) => <li key={item}>{item}</li>)}</ul>
      </Section>
      <Section title="Conclusión integrada">
        <p>{output.integrated_conclusion ?? output.preliminary_conclusion}</p>
        <ul>{list(output.material_limitations ?? output.limitations).slice(0, 1).map((item) => <li key={item}>{item}</li>)}</ul>
      </Section>
    </div>
  );
}

export function PsychAIReviewDialog({
  detail,
  busy,
  onClose,
  onSave,
  onValidate,
  onObserve,
}: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const interpretation = detail.interpretation;
  const baseOutput = interpretation?.reviewed_output ??
    interpretation?.display_output ??
    interpretation?.original_output ??
    null;
  const [comment, setComment] = useState(interpretation?.reviewer_comment ?? "");
  const [selectedRecommendation, setSelectedRecommendation] = useState<NonNullable<PsychAIOutput["recommendation"]>>(
    normalizeRecommendation(baseOutput?.recommendation),
  );
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const close = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", close);
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", close);
      previous?.focus();
    };
  }, [onClose]);

  useEffect(() => {
    setSelectedRecommendation(normalizeRecommendation(baseOutput?.recommendation));
  }, [baseOutput?.recommendation]);

  const submit = async (action: "save" | "validate" | "observe") => {
    if (!baseOutput) {
      setError("No existe informe integrado disponible para revisar.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const reviewedOutput: PsychAIOutput = {
        ...baseOutput,
        recommendation: selectedRecommendation,
      };
      if (action === "save") await onSave(reviewedOutput, comment);
      else if (action === "validate") await onValidate(reviewedOutput, comment);
      else await onObserve(reviewedOutput, comment);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No fue posible guardar la revisión profesional.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="psych-result-modal" role="dialog" aria-modal="true" aria-labelledby="psych-ai-title" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="psych-ai-dialog">
        <header>
          <div>
            <span className="psych-eyebrow">Revisión de informe integrado</span>
            <h2 id="psych-ai-title">{detail.candidate.full_name}</h2>
            <p>{detail.candidate.job_position_name} · {detail.candidate.contract_name}</p>
            <span className="psych-report-type">{isConductorPosition(detail.candidate.job_position_name) ? "Informe de Aversión al Riesgo · F-RH-071" : "Informe de Evaluación Psicolaboral · F-RH-009"}</span>
          </div>
          <button ref={closeRef} className="psych-secondary-action" type="button" onClick={onClose}>Cerrar</button>
        </header>
        <div className="psych-result-meta">
          <span>Integración basada en instrumentos aplicados</span>
          <span>Perfil: {interpretation?.profile?.label ?? "No resuelto"}</span>
        </div>
        <div className="psych-ai-review-stack">
          {renderOutput(baseOutput, selectedRecommendation, setSelectedRecommendation)}
          <label className="psych-ai-comment">
            Comentarios y validación de Psicólogo
            <textarea value={comment} onChange={(event) => setComment(event.target.value)} />
          </label>
          {error ? <p className="psych-feedback psych-feedback--error">{error}</p> : null}
          <div className="psych-actions psych-ai-review-actions">
            <button className="psych-secondary-action" type="button" disabled={busy || submitting || !baseOutput} onClick={() => void submit("save")}>Guardar comentario</button>
            <button className="psych-secondary-action" type="button" disabled={busy || submitting || !baseOutput} onClick={() => void submit("observe")}>Observar</button>
            <button className="psych-primary-action" type="button" disabled={busy || submitting || !baseOutput || !comment.trim()} onClick={() => void submit("validate")}>{submitting ? "Guardando..." : "Validar y generar informe"}</button>
          </div>
        </div>
        <div className="psych-ai-runs">
          <h3>Ejecuciones</h3>
          {(interpretation?.runs ?? []).map((run) => (
            <span key={run.id}>
              {run.status} · intento {run.attempt} · llamadas {run.api_call_count ?? (run.reviewer_executed ? 2 : 1)} · input {run.prompt_tokens ?? 0} · cache {run.cached_prompt_tokens ?? 0} · output {run.completion_tokens ?? 0} · total {run.total_tokens ?? 0} · revisor {run.reviewer_executed ? "sí" : "no"} · costo USD {(Number(run.estimated_cost_usd ?? 0)).toFixed(6)} · {run.latency_ms ?? 0} ms
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
