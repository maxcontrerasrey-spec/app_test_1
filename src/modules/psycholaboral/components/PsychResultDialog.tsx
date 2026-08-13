import { useEffect, useRef } from "react";
import type { PsychResultDetail, PsychResultInstrument } from "../types";

type Props = { detail: PsychResultDetail; onClose: () => void };

function metricEntries(instrument: PsychResultInstrument) {
  const result = instrument.result;
  if (
    result.kind === "ipip16" &&
    result.dimensions &&
    typeof result.dimensions === "object"
  ) {
    return Object.values(
      result.dimensions as Record<string, { name?: string; mean?: number }>,
    ).map((item) => ({
      label: item.name ?? "Dimensión",
      value: Number(item.mean ?? 0).toFixed(2),
    }));
  }
  if (
    result.kind === "ipc32" &&
    result.octants &&
    typeof result.octants === "object"
  ) {
    return [
      { label: "Calidez", value: String(result.warmth ?? "—") },
      { label: "Dominancia", value: String(result.dominance ?? "—") },
      ...Object.values(
        result.octants as Record<string, { name?: string; mean?: number }>,
      ).map((item) => ({
        label: item.name ?? "Octante",
        value: Number(item.mean ?? 0).toFixed(2),
      })),
    ];
  }
  if (result.kind === "barratt")
    return [
      { label: "Puntaje total", value: String(result.total ?? "—") },
      { label: "Clasificación", value: String(result.classification ?? "—") },
    ];
  const factors =
    result.factors && typeof result.factors === "object"
      ? Object.entries(result.factors as Record<string, number>).map(
          ([label, value]) => ({ label, value: Number(value).toFixed(2) }),
        )
      : [];
  if (result.kind === "prp") return [
    { label: "Puntaje directo", value: String(result.raw_total ?? "—") },
    { label: "Interpretación", value: "Revisión profesional pendiente" },
  ];
  return [
    { label: "Puntaje directo", value: String(result.raw_total ?? "—") },
    ...factors,
  ];
}

export function PsychResultDialog({ detail, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
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
  return (
    <div
      className="psych-result-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="psych-result-title"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section>
        <header>
          <div>
            <span className="psych-eyebrow">Resultado confidencial</span>
            <h2 id="psych-result-title">{detail.candidate.full_name}</h2>
            <p>
              {detail.candidate.national_id} ·{" "}
              {detail.candidate.job_position_name} ·{" "}
              {detail.candidate.contract_name}
            </p>
          </div>
          <button
            ref={closeRef}
            className="psych-secondary-action"
            type="button"
            onClick={onClose}
          >
            Cerrar
          </button>
        </header>
        <div className="psych-result-meta">
          <span>
            Finalizada {new Date(detail.completed_at).toLocaleString("es-CL")}
          </span>
          <span>
            Decisión:{" "}
            {detail.decision === "pending"
              ? "Pendiente"
              : detail.decision === "approved"
                ? "Aprobado"
                : "Rechazado"}
          </span>
        </div>
        <div className="psych-result-instruments">
          {detail.instruments.map((instrument) => (
            <article key={instrument.code}>
              <div className="psych-result-instrument-title">
                <h3>{instrument.name}</h3>
                <span>{instrument.response_count} respuestas</span>
              </div>
              <dl>
                {metricEntries(instrument).map((entry) => (
                  <div key={`${entry.label}-${entry.value}`}>
                    <dt>{entry.label}</dt>
                    <dd>{entry.value}</dd>
                  </div>
                ))}
              </dl>
              <p className="psych-result-note">
                Resultado descriptivo para revisión profesional. No constituye
                una decisión automática.
              </p>
              {instrument.quality ? (
                <p className="psych-result-note">
                  Calidad de respuestas: {String(instrument.quality.status ?? "REVISAR")} · completitud {String(instrument.quality.completitud ?? 0)}%.
                </p>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
