import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { TextField } from "../../../shared/ui";
import { SearchableSelectField as SelectField } from "../../../shared/ui/forms/SearchableSelectField";
import { formatRequestDate } from "../../../shared/lib/format";
import {
  invalidateRecruitmentControlQueries,
  useRecruitmentActiveCaseOptions,
  useRecruitmentPrecandidatesPage
} from "../hooks/useRecruitmentQueries";
import {
  approveDsalPrecandidate,
  formatRut,
  rejectDsalPrecandidate,
  type DsalPrecandidate,
  type DsalPrecandidateStatus
} from "../services/precandidates";
import { TrackingPagination } from "./TrackingPagination";

const PRECANDIDATE_PAGE_SIZE = 40;

const statusOptions: Array<{ key: DsalPrecandidateStatus | "all"; label: string }> = [
  { key: "pending", label: "Pendientes" },
  { key: "approved", label: "Aprobados" },
  { key: "rejected", label: "Rechazados" },
  { key: "all", label: "Todos" }
];

type HiringPrecandidatesViewProps = {
  onCandidateApproved: (caseId: string, candidateId: string) => Promise<void>;
};

function getPrecandidateStatusLabel(status: DsalPrecandidateStatus) {
  if (status === "pending") return "Pendiente";
  if (status === "approved") return "Aprobado";
  if (status === "rejected") return "Rechazado";
  return "Archivado";
}

function buildCaseOptionLabel(
  folio: string | null | undefined,
  caseCode: string,
  contractName: string,
  jobPositionName: string
) {
  return `Folio ${folio} · ${caseCode} · ${contractName} · ${jobPositionName}`;
}

export function HiringPrecandidatesView({ onCandidateApproved }: HiringPrecandidatesViewProps) {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<DsalPrecandidateStatus | "all">("pending");
  const [page, setPage] = useState(0);
  const [caseSelection, setCaseSelection] = useState<Record<string, string>>({});
  const [reviewComment, setReviewComment] = useState<Record<string, string>>({});
  const [rowMessage, setRowMessage] = useState<Record<string, string>>({});
  const [savingRowId, setSavingRowId] = useState("");

  const precandidatesQuery = useRecruitmentPrecandidatesPage({
    search: debouncedSearchTerm,
    status: statusFilter,
    limit: PRECANDIDATE_PAGE_SIZE,
    offset: page * PRECANDIDATE_PAGE_SIZE
  });
  const activeCaseOptionsQuery = useRecruitmentActiveCaseOptions({ limit: 500 });

  const precandidates = precandidatesQuery.data?.items ?? [];
  const totalCount = precandidatesQuery.data?.totalCount ?? 0;
  const summary = precandidatesQuery.data?.summary ?? { pending: 0, approved: 0, rejected: 0 };
  const activeCases = useMemo(
    () =>
      (activeCaseOptionsQuery.data ?? []).filter(
        (caseRow) =>
          !["filled", "closed_unfilled", "cancelled"].includes(caseRow.status) &&
          Boolean(caseRow.folio?.trim()) &&
          caseRow.requested_vacancies > caseRow.filled_vacancies
      ),
    [activeCaseOptionsQuery.data]
  );
  const caseOptions = activeCases.map((caseRow) => ({
    value: caseRow.id,
    label: buildCaseOptionLabel(
      caseRow.folio,
      caseRow.case_code,
      caseRow.contract_name,
      caseRow.job_position_name
    ),
    raw: caseRow
  }));

  const errorMessage =
    precandidatesQuery.error instanceof Error
      ? precandidatesQuery.error.message
      : activeCaseOptionsQuery.error instanceof Error
        ? activeCaseOptionsQuery.error.message
        : "";
  const isLoading = precandidatesQuery.isLoading || activeCaseOptionsQuery.isLoading;

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [searchTerm]);

  useEffect(() => {
    setPage(0);
  }, [debouncedSearchTerm, statusFilter]);

  const invalidate = async (caseId?: string) => {
    await invalidateRecruitmentControlQueries(queryClient, caseId);
  };

  const handleApprove = async (precandidate: DsalPrecandidate) => {
    const selectedCaseId = caseSelection[precandidate.id] ?? "";

    if (!selectedCaseId) {
      setRowMessage((current) => ({
        ...current,
        [precandidate.id]: "Selecciona el caso activo de destino antes de aprobar."
      }));
      return;
    }

    setSavingRowId(precandidate.id);
    setRowMessage((current) => ({ ...current, [precandidate.id]: "" }));

    const result = await approveDsalPrecandidate({
      precandidateId: precandidate.id,
      caseId: selectedCaseId,
      reviewComment: reviewComment[precandidate.id]
    });

    setSavingRowId("");

    if (result.error || !result.data) {
      setRowMessage((current) => ({
        ...current,
        [precandidate.id]: result.error ?? "No fue posible aprobar el precandidato."
      }));
      return;
    }

    await invalidate(selectedCaseId);
    await onCandidateApproved(selectedCaseId, result.data.case_candidate_id);
  };

  const handleReject = async (precandidate: DsalPrecandidate) => {
    setSavingRowId(precandidate.id);
    setRowMessage((current) => ({ ...current, [precandidate.id]: "" }));

    const result = await rejectDsalPrecandidate({
      precandidateId: precandidate.id,
      reviewComment: reviewComment[precandidate.id]
    });

    setSavingRowId("");

    if (result.error) {
      setRowMessage((current) => ({ ...current, [precandidate.id]: result.error }));
      return;
    }

    setRowMessage((current) => ({ ...current, [precandidate.id]: "Precandidato rechazado." }));
    await invalidate();
  };

  return (
    <>
      <div className="tracking-toolbar">
        <div className="tracking-toolbar-copy">
          <h3>Precandidatos</h3>
          <span className="tracking-filter-caption">
            Postulaciones públicas DSAL en revisión antes de entrar al pipeline.
          </span>
          {errorMessage ? <span className="tracking-filter-caption">{errorMessage}</span> : null}
        </div>
        <div className="tracking-filters tracking-filters-inline">
          <TextField
            id="hiring-precandidates-search"
            label="Buscar precandidatos"
            value={searchTerm}
            placeholder="Buscar por nombre, RUT, correo, teléfono o rol"
            onChange={(event) => setSearchTerm(event.target.value)}
            className="tracking-search-field"
          />
        </div>
      </div>

      <div className="tracking-kpi-row tracking-kpi-row-compact">
        <article className="tracking-kpi-card tracking-kpi-card-pendiente">
          <span className="micro-label">Pendientes</span>
          <strong>{summary.pending}</strong>
        </article>
        <article className="tracking-kpi-card tracking-kpi-card-generado">
          <span className="micro-label">Aprobados</span>
          <strong>{summary.approved}</strong>
        </article>
        <article className="tracking-kpi-card tracking-kpi-card-rechazado">
          <span className="micro-label">Rechazados</span>
          <strong>{summary.rejected}</strong>
        </article>
      </div>

      <div className="approval-chip-row">
        {statusOptions.map((option) => (
          <button
            key={option.key}
            type="button"
            className={`approval-chip ${statusFilter === option.key ? "tracking-kpi-card-active" : ""}`}
            onClick={() => setStatusFilter(option.key)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="tracking-table-wrap tracking-table-wrap-full">
        <div className="tracking-table-scroll tracking-table-scroll-wide">
          <table className="tracking-table">
            <thead>
              <tr>
                <th>Precandidato</th>
                <th>Contacto</th>
                <th>Domicilio</th>
                <th>Licencias</th>
                <th>Rol DSAL</th>
                <th>Revisión</th>
              </tr>
            </thead>
            <tbody>
              {precandidates.length > 0 ? (
                precandidates.map((precandidate) => (
                  <tr key={precandidate.id}>
                    <td>
                      <strong>{precandidate.full_name}</strong>
                      <div className="tracking-filter-caption">
                        {formatRut(precandidate.national_id)}
                      </div>
                      <div className="tracking-filter-caption">
                        Ingreso: {formatRequestDate(precandidate.submitted_at)}
                      </div>
                    </td>
                    <td>
                      <strong>{precandidate.phone}</strong>
                      <div className="tracking-filter-caption">{precandidate.personal_email}</div>
                    </td>
                    <td>
                      <strong>{precandidate.current_city}</strong>
                      <div className="tracking-filter-caption">{precandidate.region}</div>
                      <div className="tracking-filter-caption">{precandidate.address_line}</div>
                    </td>
                    <td>{precandidate.driver_license_classes.join(", ")}</td>
                    <td>{precandidate.dsal_role}</td>
                    <td className="precandidate-review-cell">
                      <span className={`tracking-status-pill tracking-status-${precandidate.status}`}>
                        {getPrecandidateStatusLabel(precandidate.status)}
                      </span>
                      {precandidate.status === "pending" ? (
                        <div className="precandidate-review-stack">
                          <SelectField
                            id={`precandidate-case-${precandidate.id}`}
                            label="Folio de contratación destino"
                            value={caseSelection[precandidate.id] ?? ""}
                            options={caseOptions}
                            placeholder="Selecciona un folio con cupo"
                            onChange={(event) =>
                              setCaseSelection((current) => ({
                                ...current,
                                [precandidate.id]: event.target.value
                              }))
                            }
                          />
                          <label className="field-group" htmlFor={`precandidate-comment-${precandidate.id}`}>
                            <span className="field-label">Comentario de revisión</span>
                            <textarea
                              id={`precandidate-comment-${precandidate.id}`}
                              className="control-textarea"
                              value={reviewComment[precandidate.id] ?? ""}
                              onChange={(event) =>
                                setReviewComment((current) => ({
                                  ...current,
                                  [precandidate.id]: event.target.value
                                }))
                              }
                              rows={3}
                            />
                          </label>
                          {caseOptions.length === 0 && !activeCaseOptionsQuery.isLoading ? (
                            <p className="form-status form-status-error">
                              No hay folios de contratación aprobados con cupo disponible. Solicita a la
                              gerencia respectiva la creación y aprobación del folio antes de convertir este
                              precandidato en candidato.
                            </p>
                          ) : null}
                          <div className="approval-action-row">
                            <button
                              type="button"
                              className="soft-primary-button approval-button-approve"
                              disabled={savingRowId === precandidate.id || caseOptions.length === 0}
                              onClick={() => void handleApprove(precandidate)}
                            >
                              {savingRowId === precandidate.id ? "Aprobando..." : "Aprobar"}
                            </button>
                            <button
                              type="button"
                              className="soft-primary-button approval-button-reject"
                              disabled={savingRowId === precandidate.id}
                              onClick={() => void handleReject(precandidate)}
                            >
                              Rechazar
                            </button>
                          </div>
                          {rowMessage[precandidate.id] ? (
                            <p className="form-status form-status-error">
                              {rowMessage[precandidate.id]}
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <div className="tracking-filter-caption">
                          {precandidate.review_comment || "Sin comentario de revisión."}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="tracking-empty-state" colSpan={6}>
                    {isLoading ? "Cargando precandidatos..." : "No hay precandidatos para el filtro actual."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <TrackingPagination
          page={page}
          pageSize={PRECANDIDATE_PAGE_SIZE}
          totalCount={totalCount}
          label="Precandidatos"
          onPageChange={setPage}
        />
      </div>
    </>
  );
}
