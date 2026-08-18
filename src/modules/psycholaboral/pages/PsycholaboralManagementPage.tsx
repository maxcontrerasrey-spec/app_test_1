import { Fragment, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/lib/queryKeys";
import { PageShell, TextField } from "../../../shared/ui";
import { TrackingPagination } from "../../recruitment/components/TrackingPagination";
import { PsychAIReviewDialog } from "../components/PsychAIReviewDialog";
import { PsychResultDialog } from "../components/PsychResultDialog";
import {
  decidePsychAssessment,
  generatePsychCertificate,
  getPsychAIReviewDetail,
  getPsychCertificateUrl,
  getPsychReportUrl,
  resetPsychCertificate,
  getPsychResult,
  reviewPsychAIInterpretation,
  sendPsychBattery,
} from "../services/psycholaboralApi";
import {
  usePsychCandidates,
  usePsychCatalog,
} from "../hooks/usePsycholaboralQueries";
import type { PsychAIOutput, PsychAIReviewDetail, PsychCandidate, PsychResultDetail } from "../types";
import "../styles/psycholaboral.css";

const statusLabels = {
  not_sent: "No realizado",
  sent: "Enviado",
  expired: "Desierto",
  completed: "Terminado",
} as const;
const PAGE_SIZE = 50;
const aiStatusLabels: Record<string, string> = {
  NOT_REQUESTED: "No solicitado",
  QUEUED: "En cola",
  PROCESSING: "Procesando",
  AI_DRAFT: "Borrador",
  FAILED: "Fallida",
  PENDING_REVIEW: "Pendiente revisión",
  REVIEWED: "Revisada",
  VALIDATED: "Validada",
  OBSERVED: "Observada",
};
function dateTime(value: string | null) {
  return value ? new Date(value).toLocaleString("es-CL") : "Sin registro";
}

export function PsycholaboralManagementPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [result, setResult] = useState<PsychResultDetail | null>(null);
  const [aiReview, setAiReview] = useState<PsychAIReviewDetail | null>(null);
  const filters = useMemo(
    () => ({ search, status, limit: PAGE_SIZE, offset: page * PAGE_SIZE }),
    [page, search, status],
  );
  const candidates = usePsychCandidates(filters);
  const catalog = usePsychCatalog();
  const rows = candidates.data?.items ?? [];
  const counts = rows.reduce(
    (acc, row) => ({
      ...acc,
      [row.display_status]: (acc[row.display_status] ?? 0) + 1,
    }),
    {} as Record<string, number>,
  );
  const tabs = [
    { key: "", label: "Todos" },
    { key: "not_sent", label: "No realizado" },
    { key: "sent", label: "Enviado" },
    { key: "expired", label: "Desierto" },
    { key: "completed", label: "Terminado" },
  ] as const;
  const refresh = async () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.psycholaboral.all() });
  const toggleTest = (id: string, code: string) =>
    setSelected((current) => ({
      ...current,
      [id]: current[id]?.includes(code)
        ? current[id].filter((item) => item !== code)
        : [...(current[id] ?? []), code],
    }));
  const send = async (row: PsychCandidate) => {
    const codes = selected[row.id] ?? [];
    if (!codes.length) return setFeedback("Selecciona al menos un test.");
    setBusy(row.id);
    setFeedback("");
    try {
      await sendPsychBattery(row.id, codes);
      setFeedback(`Batería enviada a ${row.email}.`);
      await refresh();
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : "No fue posible enviar.",
      );
    } finally {
      setBusy(null);
    }
  };
  const decide = async (
    row: PsychCandidate,
    decision: "approved" | "rejected",
  ) => {
    if (!row.assessment_id) return;
    const comment =
      decision === "rejected"
        ? window
            .prompt(
              "Indica el motivo del rechazo. El candidato será descartado del proceso:",
            )
            ?.trim()
        : undefined;
    if (decision === "rejected" && !comment) return;
    if (
      !window.confirm(
        decision === "rejected"
          ? "¿Rechazar y descartar al candidato del proceso activo?"
          : "¿Aprobar la evaluación psicolaboral?",
      )
    )
      return;
    setBusy(row.id);
    try {
      await decidePsychAssessment(row.assessment_id, decision, comment);
      await refresh();
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : "No fue posible decidir.",
      );
    } finally {
      setBusy(null);
    }
  };
  const inspect = async (row: PsychCandidate) => {
    if (!row.assessment_id) return;
    setBusy(row.id);
    try {
      setResult(await getPsychResult(row.assessment_id));
    } catch (error) {
      setFeedback(
        error instanceof Error
          ? error.message
          : "No fue posible cargar el resultado.",
      );
    } finally {
      setBusy(null);
    }
  };
  const download = async (row: PsychCandidate) => {
    if (!row.assessment_id) return;
    try {
      window.open(
        await getPsychCertificateUrl(row.assessment_id),
        "_blank",
        "noopener,noreferrer",
      );
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : "Certificado no disponible.",
      );
    }
  };
  const downloadReport = async (row: PsychCandidate) => {
    if (!row.assessment_id) return;
    try {
      window.open(await getPsychReportUrl(row.assessment_id), "_blank", "noopener,noreferrer");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Informe no disponible.");
    }
  };
  const generateCertificate = async (row: PsychCandidate) => {
    if (!row.assessment_id) return;
    setBusy(row.id);
    setFeedback("");
    try {
      if (row.certificate_status === "generated") {
        await resetPsychCertificate(row.assessment_id);
      }
      await generatePsychCertificate(row.assessment_id);
      setFeedback("Certificado generado correctamente.");
      await refresh();
    } catch (error) {
      setFeedback(
        error instanceof Error
          ? error.message
          : "No fue posible generar el certificado.",
      );
    } finally {
      setBusy(null);
    }
  };
  const openAIReview = async (row: PsychCandidate) => {
    if (!row.assessment_id) return;
    setBusy(row.id);
    try {
      setAiReview(await getPsychAIReviewDetail(row.assessment_id));
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "No fue posible abrir la revisión IA.");
    } finally {
      setBusy(null);
    }
  };
  const reviewAI = async (
    action: "save_review" | "validate" | "observe",
    output: PsychAIOutput,
    comment: string,
  ) => {
    if (!aiReview?.interpretation) return;
    const next = await reviewPsychAIInterpretation({
      assessmentId: aiReview.assessment_id,
      interpretationId: aiReview.interpretation.id,
      action,
      reviewedOutput: output,
      comment,
    });
    setAiReview(next);
    if (action === "validate") {
      setFeedback("Validación registrada. Generando informe firmado...");
      await generatePsychCertificate(aiReview.assessment_id);
    }
    await refresh();
  };

  return (
    <PageShell className="psych-command">
      <div className="minimal-page-header psych-minimal-header">
        <h1>Gestión Psicolaboral</h1>
      </div>
      <section className="tracking-panel psych-tracking-panel">
        <div className="tracking-kpi-row" aria-label="Resumen psicolaboral">
          <button
            type="button"
            className={`tracking-kpi-card tracking-kpi-card-folio-search ${status === "" ? "tracking-kpi-card-active" : ""}`}
            onClick={() => {
              setStatus("");
              setPage(0);
            }}
          >
            <span className="micro-label">Candidatos visibles</span>
            <strong>{rows.length}</strong>
            <small>Página actual</small>
          </button>
          {(["not_sent", "sent", "expired", "completed"] as const).map((item) => (
            <button
              type="button"
              className={`tracking-kpi-card ${item === "completed" ? "tracking-kpi-card-generado" : "tracking-kpi-card-en-proceso"} ${status === item ? "tracking-kpi-card-active" : ""}`}
              key={item}
              onClick={() => {
                setStatus(status === item ? "" : item);
                setPage(0);
              }}
            >
              <span className="micro-label">{statusLabels[item]}</span>
              <strong>{counts[item] ?? 0}</strong>
              <small>Página actual</small>
            </button>
          ))}
        </div>
        <div className="approval-chip-row psych-status-tabs">
          {tabs.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`approval-chip ${status === item.key ? "tracking-kpi-card-active" : ""}`}
              onClick={() => {
                setStatus(item.key);
                setPage(0);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="tracking-toolbar psych-toolbar">
          <div className="tracking-toolbar-copy">
            <h3>Seguimiento de evaluaciones</h3>
            <span className="tracking-filter-caption">
              Candidatos activos con batería psicolaboral pendiente, enviada o
              terminada.
            </span>
          </div>
          <div className="tracking-filters tracking-filters-inline psych-filters">
            <TextField
              id="psych-search"
              label="Buscar candidatos"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(0);
              }}
              className="tracking-search-field"
              placeholder="Nombre, RUT, folio, cargo o contrato"
            />
            <button
              className="psych-secondary-action"
              type="button"
              onClick={() => void refresh()}
            >
              Actualizar
            </button>
          </div>
        </div>
        {feedback ? (
          <div className="psych-feedback" role="status">
            {feedback}
          </div>
        ) : null}
        {candidates.isLoading || catalog.isLoading ? (
          <div className="psych-skeleton">
            Cargando candidatos y batería disponible...
          </div>
        ) : candidates.error || catalog.error ? (
          <div className="psych-feedback psych-feedback--error">
            No fue posible cargar Gestión Psicolaboral.
          </div>
        ) : rows.length === 0 ? (
          <div className="psych-empty">
            <strong>No hay candidatos para mostrar</strong>
            <span>Ajusta la búsqueda o el estado seleccionado.</span>
          </div>
        ) : (
          <div className="tracking-table-wrap tracking-table-wrap-full">
            <div className="tracking-table-scroll tracking-table-scroll-wide">
              <table className="tracking-table psych-table">
            <thead>
              <tr>
                <th></th>
                <th>Candidato</th>
                <th>Proceso</th>
                <th>Cargo / contrato</th>
                <th>Correo</th>
                <th>Estado</th>
                <th>Actualización</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <Fragment key={row.id}>
                  <tr
                    key={row.id}
                    className={`tracking-table-row-clickable ${expanded === row.id ? "tracking-table-row-expanded" : ""}`}
                    onClick={() =>
                      setExpanded(expanded === row.id ? null : row.id)
                    }
                    tabIndex={0}
                    aria-expanded={expanded === row.id}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setExpanded(expanded === row.id ? null : row.id);
                      }
                    }}
                  >
                    <td>{expanded === row.id ? "−" : "+"}</td>
                    <td>
                      <strong>{row.full_name}</strong>
                      <small>{row.national_id}</small>
                    </td>
                    <td>
                      <strong>{row.case_code}</strong>
                      <small>Folio {row.folio}</small>
                    </td>
                    <td>
                      {row.job_position_name}
                      <small>{row.contract_name}</small>
                    </td>
                    <td>{row.email ?? "Sin correo"}</td>
                    <td>
                      <span
                        className={`psych-status psych-status--${row.display_status}`}
                      >
                        {statusLabels[row.display_status]}
                      </span>
                      {row.decision && row.decision !== "pending" ? (
                        <small>
                          Decisión:{" "}
                          {row.decision === "approved"
                            ? "Aprobado"
                            : "Rechazado"}
                        </small>
                      ) : null}
                    </td>
                    <td className="psych-update-cell">
                      <div className="psych-update-cell__content">
                        <span>
                          {dateTime(
                            row.completed_at ?? row.started_at ?? row.issued_at,
                          )}
                        </span>
                        {row.certificate_status === "generated" ? (
                          <button
                            type="button"
                            className="psych-icon-action"
                            title="Descargar certificado"
                            aria-label={`Descargar certificado de ${row.full_name}`}
                            disabled={busy === row.id}
                            onClick={(event) => {
                              event.stopPropagation();
                              void download(row);
                            }}
                          >
                            PDF
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                  {expanded === row.id ? (
                    <tr
                      className="tracking-table-expanded-row"
                      key={`${row.id}-detail`}
                    >
                      <td colSpan={7}>
                        <div className="expanded-case-detail-grid">
                          <section className="expanded-detail-section">
                            <h3>Batería psicolaboral</h3>
                            {row.assessment_id && row.display_status !== "expired" ? (
                              <div className="psych-instrument-list">
                                {row.instruments.map((instrument) => (
                                  <span
                                    key={instrument.code}
                                    className={`psych-instrument-card psych-instrument-card--${instrument.status}`}
                                  >
                                    {instrument.name}
                                    <small>
                                      {instrument.answered}/{instrument.total} ·{" "}
                                      {instrument.status}
                                    </small>
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <div className="approval-chip-row psych-test-chip-row">
                                {catalog.data?.map((instrument) => (
                                  <button
                                    type="button"
                                    className="approval-chip"
                                    aria-pressed={(
                                      selected[row.id] ?? []
                                    ).includes(instrument.code)}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      toggleTest(row.id, instrument.code);
                                    }}
                                    key={instrument.code}
                                  >
                                    <span>{instrument.short_name}</span>
                                    <small>
                                      {instrument.question_count} preguntas
                                    </small>
                                  </button>
                                ))}
                              </div>
                            )}
                          </section>
                          <section className="expanded-detail-section">
                            <h3>Hitos</h3>
                            <dl className="psych-timeline">
                              <div>
                                <dt>Enviado</dt>
                                <dd>{dateTime(row.issued_at)}</dd>
                              </div>
                              <div>
                                <dt>Inicio</dt>
                                <dd>{dateTime(row.started_at)}</dd>
                              </div>
                              <div>
                                <dt>Término</dt>
                                <dd>{dateTime(row.completed_at)}</dd>
                              </div>
                              <div>
                                <dt>Certificado</dt>
                                <dd>
                                  {row.certificate_status ?? "No preparado"}
                                </dd>
                              </div>
                              <div>
                                <dt>Informe integrado</dt>
                                <dd>
                                  {aiStatusLabels[row.ai_status ?? "NOT_REQUESTED"] ?? row.ai_status ?? "No solicitado"}
                                </dd>
                              </div>
                            </dl>
                          </section>
                          <section className="expanded-detail-section expanded-detail-section-full psych-actions-section">
                            <div className="psych-actions">
                              {!row.assessment_id || row.display_status === "expired" ? (
                                <button
                                  className="psych-primary-action"
                                  type="button"
                                  disabled={busy === row.id || !row.email}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void send(row);
                                  }}
                                >
                                  {row.display_status === "expired" ? "Reenviar test" : "Enviar test"}
                                </button>
                              ) : null}
                              {row.display_status === "completed" ? (
                                <>
                                  <button
                                    className="psych-secondary-action"
                                    type="button"
                                    disabled={busy === row.id}
                                    onClick={() => void inspect(row)}
                                  >
                                    Ver resultados
                                  </button>
                                  {row.ai_status === "PENDING_REVIEW" ||
                                  row.ai_status === "REVIEWED" ||
                                  row.ai_status === "VALIDATED" ||
                                  row.ai_status === "OBSERVED" ? (
                                    <button
                                      className="psych-secondary-action"
                                      type="button"
                                      disabled={busy === row.id}
                                      onClick={() => void openAIReview(row)}
                                    >
                                      Revisar informe
                                    </button>
                                  ) : (
                                    <span className="approval-chip">
                                      Informe: {aiStatusLabels[row.ai_status ?? "NOT_REQUESTED"] ?? row.ai_status ?? "No solicitado"}
                                    </span>
                                  )}
                                  {row.certificate_status === "generated" ? (
                                    <>
                                      <button className="psych-secondary-action" type="button" disabled={busy === row.id} onClick={() => void download(row)}>
                                        Descargar certificado
                                      </button>
                                      <button className="psych-secondary-action" type="button" disabled={busy === row.id} onClick={() => void downloadReport(row)}>
                                        Descargar informe
                                      </button>
                                      <button className="psych-secondary-action" type="button" disabled={busy === row.id} onClick={() => void generateCertificate(row)}>
                                        Actualizar informe
                                      </button>
                                    </>
                                  ) : (row.certificate_status === "queued" ||
                                    row.certificate_status === "failed") && row.ai_status === "VALIDATED" ? (
                                    <button
                                      className="psych-secondary-action"
                                      type="button"
                                      disabled={busy === row.id}
                                      onClick={() =>
                                        void generateCertificate(row)
                                      }
                                    >
                                      Generar informe y PDF
                                    </button>
                                  ) : null}
                                  {row.decision === "pending" ? (
                                    <>
                                      <button
                                        className="psych-primary-action"
                                        type="button"
                                        disabled={busy === row.id}
                                        onClick={() =>
                                          void decide(row, "approved")
                                        }
                                      >
                                        Aprobar
                                      </button>
                                      <button
                                        className="psych-danger-action"
                                        type="button"
                                        disabled={busy === row.id}
                                        onClick={() =>
                                          void decide(row, "rejected")
                                        }
                                      >
                                        Rechazar
                                      </button>
                                    </>
                                  ) : null}
                                </>
                              ) : null}
                            </div>
                          </section>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
              </table>
            </div>
          </div>
        )}
        <TrackingPagination
          page={page}
          pageSize={PAGE_SIZE}
          totalCount={candidates.data?.total_count ?? 0}
          label="Candidatos"
          onPageChange={setPage}
        />
      </section>
      {result ? (
        <PsychResultDialog detail={result} onClose={() => setResult(null)} />
      ) : null}
      {aiReview ? (
        <PsychAIReviewDialog
          detail={aiReview}
          busy={Boolean(busy)}
          onClose={() => setAiReview(null)}
          onSave={(output, comment) => reviewAI("save_review", output, comment)}
          onValidate={(output, comment) => reviewAI("validate", output, comment)}
          onObserve={(output, comment) => reviewAI("observe", output, comment)}
        />
      ) : null}
    </PageShell>
  );
}
