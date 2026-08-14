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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="psych-ai-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function renderOutput(output: PsychAIOutput | null) {
  if (!output) return <p className="psych-result-note">Sin interpretación disponible.</p>;
  return (
    <div className="psych-ai-output">
      <Section title="Resumen ejecutivo">
        <p>{output.executive_summary}</p>
        <p className="psych-result-note">{output.response_quality}</p>
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
      <Section title="Instrumentos">
        <p><strong>IPIP-16:</strong> {output.ipip16.summary}</p>
        <p><strong>IPIP-IPC:</strong> {output.ipc.summary}</p>
        <p className="psych-result-note">{output.ipc.disc_disclaimer}</p>
        <p><strong>BIS-11:</strong> {output.bis11.impulsivity_interpretation}</p>
        <p><strong>PRP:</strong> {output.prp.documentation_status}</p>
      </Section>
      <Section title="Integración y límites">
        <p>{output.integrated_analysis}</p>
        <p>{output.preliminary_conclusion}</p>
        <ul>{list(output.limitations).map((item) => <li key={item}>{item}</li>)}</ul>
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
  const [error, setError] = useState("");

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

  const submit = async (action: "save" | "validate" | "observe") => {
    if (!baseOutput) {
      setError("No existe interpretación IA disponible para revisar.");
      return;
    }
    setError("");
    if (action === "save") await onSave(baseOutput, comment);
    else if (action === "validate") await onValidate(baseOutput, comment);
    else await onObserve(baseOutput, comment);
  };

  return (
    <div className="psych-result-modal" role="dialog" aria-modal="true" aria-labelledby="psych-ai-title" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="psych-ai-dialog">
        <header>
          <div>
            <span className="psych-eyebrow">Revisión profesional IA</span>
            <h2 id="psych-ai-title">{detail.candidate.full_name}</h2>
            <p>{detail.candidate.job_position_name} · {detail.candidate.contract_name}</p>
          </div>
          <button ref={closeRef} className="psych-secondary-action" type="button" onClick={onClose}>Cerrar</button>
        </header>
        <div className="psych-result-meta">
          <span>Estado IA: {detail.ai_status}</span>
          <span>Proveedor: {interpretation?.provider ?? "Sin registro"}</span>
          <span>Perfil: {interpretation?.profile?.label ?? "No resuelto"}</span>
        </div>
        <div className="psych-ai-review-stack">
          {renderOutput(baseOutput)}
          <label className="psych-ai-comment">
            Comentario profesional
            <textarea value={comment} onChange={(event) => setComment(event.target.value)} />
          </label>
          {error ? <p className="psych-feedback psych-feedback--error">{error}</p> : null}
          <div className="psych-actions psych-ai-review-actions">
            <button className="psych-secondary-action" type="button" disabled={busy || !baseOutput} onClick={() => void submit("save")}>Guardar comentario</button>
            <button className="psych-secondary-action" type="button" disabled={busy || !baseOutput} onClick={() => void submit("observe")}>Observar</button>
            <button className="psych-primary-action" type="button" disabled={busy || !baseOutput} onClick={() => void submit("validate")}>Validar</button>
          </div>
        </div>
        <div className="psych-ai-runs">
          <h3>Ejecuciones</h3>
          {(interpretation?.runs ?? []).map((run) => (
            <span key={run.id}>{run.status} · intento {run.attempt} · {run.total_tokens ?? 0} tokens · {run.latency_ms ?? 0} ms</span>
          ))}
        </div>
      </section>
    </div>
  );
}
