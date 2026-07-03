import { useEffect, useMemo, useState } from "react";
import { TextField } from "../../../shared/ui";
import { useAuth } from "../../auth/context/AuthContext";
import {
  fetchCandidateBukProfile,
  formatRut,
  generateCandidatesInBuk,
  type RecruitmentCaseDetail,
  type RecruitmentPersonnelToHireRow
} from "../services/hiringControl";
import {
  useRecruitmentContractedPersonnelPage,
  useRecruitmentPersonnelToHirePage
} from "../hooks/useRecruitmentQueries";
import { formatDateTimeValue } from "./hiringControlViewUtils";
import { CandidateDetailSidebar } from "./CandidateDetailSidebar";
import { exportBukNominaXls } from "../lib/bukEmployeeNomina";
import { TrackingPagination } from "./TrackingPagination";

const PERSONNEL_PAGE_SIZE = 50;

type PersonnelBucket = "to_hire" | "contracted";

type HiringPersonnelToHireViewProps = {
  bucket?: PersonnelBucket;
  isParentLoading: boolean;
  errorMessage: string;
  selectedCandidateId: string;
  selectedCaseDetail: RecruitmentCaseDetail | null;
  onSelectCandidate: (candidateId: string, caseId: string) => void;
  onLicenseUpdated: () => Promise<void>;
  onInterviewNotesUpdated: () => Promise<void>;
  onCandidateFileUpdated: () => Promise<void>;
};

export function HiringPersonnelToHireView({
  bucket = "to_hire",
  isParentLoading,
  errorMessage,
  selectedCandidateId,
  selectedCaseDetail,
  onSelectCandidate,
  onLicenseUpdated,
  onInterviewNotesUpdated,
  onCandidateFileUpdated
}: HiringPersonnelToHireViewProps) {
  const { appRoles, isSuperAdmin } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [page, setPage] = useState(0);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [isGeneratingBuk, setIsGeneratingBuk] = useState(false);
  const [exportMessage, setExportMessage] = useState("");
  const filters = {
    search: debouncedSearchTerm,
    limit: PERSONNEL_PAGE_SIZE,
    offset: page * PERSONNEL_PAGE_SIZE
  };
  const toHireQuery = useRecruitmentPersonnelToHirePage(filters, bucket === "to_hire");
  const contractedQuery = useRecruitmentContractedPersonnelPage(filters, bucket === "contracted");
  const personnelQuery = bucket === "contracted" ? contractedQuery : toHireQuery;
  const personnelToHire = personnelQuery.data?.items ?? [];
  const totalCount = personnelQuery.data?.totalCount ?? 0;
  const personnelError =
    personnelQuery.error instanceof Error ? personnelQuery.error.message : "";
  const combinedErrorMessage = errorMessage || personnelError;
  const isLoading = isParentLoading || personnelQuery.isLoading;
  const canManageBukActions =
    isSuperAdmin ||
    appRoles.includes("administrativo") ||
    appRoles.includes("jefe_administrativo");
  const showBukActions = bucket === "to_hire" && canManageBukActions;
  const title = bucket === "to_hire" ? "Personal a Contratar" : "Personal contratado";
  const description =
    bucket === "to_hire"
      ? "Candidatos pendientes de generación efectiva en BUK."
      : "Personal con generación BUK confirmada y retirado de la cola pendiente.";
  const dateLabel =
    bucket === "to_hire" ? "Fecha listo para contratar" : "Fecha generación BUK";
  const emptyMessage =
    bucket === "to_hire"
      ? "No hay personas listas para contratar para el filtro actual."
      : "No hay personal contratado para el filtro actual.";

  const selectedCandidateBoardRow =
    personnelToHire.find((candidate) => candidate.id === selectedCandidateId) ??
    null;

  const selectedCandidate =
    selectedCaseDetail?.candidates.find((candidate) => candidate.id === selectedCandidateId) ??
    null;

  const selectedPersonnel = useMemo(
    () => personnelToHire.filter((candidate) => selectedCandidateIds.includes(candidate.id)),
    [personnelToHire, selectedCandidateIds]
  );

  const allFilteredSelected =
    showBukActions &&
    personnelToHire.length > 0 &&
    personnelToHire.every((candidate) => selectedCandidateIds.includes(candidate.id));

  const visibleSelectedCount = personnelToHire.filter((candidate) =>
    selectedCandidateIds.includes(candidate.id)
  ).length;

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [searchTerm]);

  useEffect(() => {
    setPage(0);
  }, [debouncedSearchTerm, bucket]);

  useEffect(() => {
    if (!showBukActions) {
      setSelectedCandidateIds([]);
      return;
    }

    setSelectedCandidateIds((current) =>
      current.filter((candidateId) => personnelToHire.some((candidate) => candidate.id === candidateId))
    );
  }, [personnelToHire, showBukActions]);

  const toggleCandidateSelection = (candidateId: string) => {
    if (!showBukActions) {
      return;
    }

    setSelectedCandidateIds((current) =>
      current.includes(candidateId)
        ? current.filter((id) => id !== candidateId)
        : [...current, candidateId]
    );
  };

  const toggleSelectAllFiltered = () => {
    if (!showBukActions) {
      return;
    }

    const filteredIds = personnelToHire.map((candidate) => candidate.id);

    setSelectedCandidateIds((current) => {
      if (filteredIds.every((id) => current.includes(id))) {
        return current.filter((id) => !filteredIds.includes(id));
      }

      return Array.from(new Set([...current, ...filteredIds]));
    });
  };

  const handleExportNomina = async () => {
    if (!showBukActions) {
      setExportMessage("Solo RRHH administrativo puede exportar la nómina.");
      return;
    }

    if (selectedPersonnel.length === 0) {
      setExportMessage("Selecciona al menos una persona para exportar la nómina.");
      return;
    }

    setIsExporting(true);
    setExportMessage("");

    try {
      const results = await Promise.all(
        selectedPersonnel.map(async (candidate) => {
          const profileResult = await fetchCandidateBukProfile(candidate.id);

          return {
            candidate,
            bukProfile: profileResult.error ? null : profileResult.data,
            error: profileResult.error
          };
        })
      );

      await exportBukNominaXls(
        results.map(({ candidate, bukProfile }) => ({
          candidate,
          bukProfile
        }))
      );

      const incompleteCount = results.filter((result) => result.error).length;

      setExportMessage(
        incompleteCount > 0
          ? `Nómina exportada. ${incompleteCount} ficha(s) se completaron parcialmente porque no se pudo cargar toda la ficha BUK.`
          : `Nómina exportada correctamente con ${results.length} persona(s).`
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No fue posible exportar la nómina.";
      setExportMessage(`No fue posible exportar la nómina. ${message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleGenerateBuk = async () => {
    if (!showBukActions) {
      setExportMessage("Solo RRHH administrativo puede generar personal en BUK.");
      return;
    }

    if (selectedPersonnel.length === 0) {
      setExportMessage("Selecciona al menos una persona para generar en BUK.");
      return;
    }

    setIsGeneratingBuk(true);
    setExportMessage("");

    const { data, processed, error, dispatchError } = await generateCandidatesInBuk(
      selectedPersonnel.map((candidate) => candidate.id)
    );

    if (error) {
      setExportMessage(error);
      setIsGeneratingBuk(false);
      return;
    }

    const queuedCount = data.filter((job) => job.status === "pending").length;
    const processingCount = data.filter((job) => job.status === "processing").length;
    const successCount = processed.filter((job) => job.status === "success").length;
    const failedJobs = processed.filter((job) => job.status === "error");

    if (dispatchError) {
      setExportMessage(
        `Se encolaron ${queuedCount} persona(s), pero no se pudo ejecutar la sincronización automática con BUK. ${dispatchError}`
      );
      setIsGeneratingBuk(false);
      return;
    }

    setExportMessage(
      failedJobs.length > 0
        ? `BUK procesó ${successCount} persona(s) correctamente, ${failedJobs.length} fallaron${
            processingCount > 0 ? ` y ${processingCount} siguen en procesamiento` : ""
          }. ${failedJobs
            .map((job) => job.error)
            .filter(Boolean)
            .join(" | ")}`
        : processingCount > 0
          ? `BUK procesó ${successCount} persona(s). ${processingCount} siguen en procesamiento en segundo plano.`
          : `BUK procesó ${successCount} persona(s) correctamente.`
    );
    setSelectedCandidateIds([]);
    await onCandidateFileUpdated();
    setIsGeneratingBuk(false);
  };

  const emptyColSpan = showBukActions ? 7 : 6;

  return (
    <>
      <div className="tracking-toolbar">
        <div className="tracking-toolbar-copy">
          <h3>{title}</h3>
          <span className="tracking-filter-caption">
            {combinedErrorMessage || description}
          </span>
        </div>
        <div className="tracking-filters tracking-filters-inline">
          <TextField
            id={`hiring-personnel-search-${bucket}`}
            label="Buscar personal"
            value={searchTerm}
            placeholder="Buscar por candidato, RUT, caso, contrato o aprobador"
            onChange={(event) => setSearchTerm(event.target.value)}
            className="tracking-search-field"
          />
          {showBukActions ? (
            <>
              <button
                type="button"
                className="soft-primary-button approval-button-approve"
                onClick={() => void handleGenerateBuk()}
                disabled={isGeneratingBuk || selectedPersonnel.length === 0}
              >
                {isGeneratingBuk
                  ? "Generando..."
                  : `Generar en BUK (${selectedPersonnel.length})`}
              </button>
              <button
                type="button"
                className="soft-primary-button approval-button-approve"
                onClick={() => void handleExportNomina()}
                disabled={isExporting || selectedPersonnel.length === 0}
              >
                {isExporting ? "Exportando..." : `Exportar nómina (${selectedPersonnel.length})`}
              </button>
            </>
          ) : null}
        </div>
      </div>
      {exportMessage ? <p className="tracking-filter-caption">{exportMessage}</p> : null}

      <div
        className="control-layout"
        style={!selectedCandidateBoardRow ? { gridTemplateColumns: "1fr" } : undefined}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onSelectCandidate("", "");
          }
        }}
      >
        <div className="tracking-table-wrap">
          <div className="tracking-table-scroll">
            <table className="tracking-table">
              <thead>
                <tr>
                  {showBukActions ? (
                    <th className="tracking-selection-cell">
                      <input
                        type="checkbox"
                        checked={allFilteredSelected}
                        aria-label="Seleccionar personal filtrado"
                        onChange={toggleSelectAllFiltered}
                      />
                    </th>
                  ) : null}
                  <th>Candidato</th>
                  <th>Caso</th>
                  <th>Cargo</th>
                  <th>Contrato</th>
                  <th>{dateLabel}</th>
                  <th>Owner</th>
                </tr>
              </thead>
              <tbody>
                {personnelToHire.length > 0 ? (
                  personnelToHire.map((candidate) => (
                    <tr
                      key={candidate.id}
                      className={
                        candidate.id === selectedCandidateBoardRow?.id ? "tracking-row-selected" : ""
                      }
                      onClick={() => onSelectCandidate(candidate.id, candidate.recruitment_case_id)}
                    >
                      {showBukActions ? (
                        <td className="tracking-selection-cell">
                          <input
                            type="checkbox"
                            checked={selectedCandidateIds.includes(candidate.id)}
                            aria-label={`Seleccionar ${candidate.full_name}`}
                            onClick={(event) => event.stopPropagation()}
                            onChange={() => toggleCandidateSelection(candidate.id)}
                          />
                        </td>
                      ) : null}
                      <td>
                        <strong>{candidate.full_name}</strong>
                        <div className="tracking-filter-caption">
                          {formatRut(candidate.national_id)}
                        </div>
                      </td>
                      <td>{candidate.case_code}</td>
                      <td>{candidate.job_position_name}</td>
                      <td>{candidate.contract_name}</td>
                      <td>
                        {formatDateTimeValue(
                          bucket === "contracted"
                            ? candidate.buk_generated_at ??
                                candidate.hired_at ??
                                candidate.stage_entered_at
                            : candidate.stage_entered_at
                        )}
                      </td>
                      <td>{candidate.owner_name ?? "No asignado"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="tracking-empty-state" colSpan={emptyColSpan}>
                      {isLoading ? "Cargando personal..." : emptyMessage}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <CandidateDetailSidebar
          mode="personnel_to_hire"
          isLoading={isLoading}
          selectedCaseDetail={selectedCaseDetail}
          selectedCandidate={selectedCandidate}
          selectedCandidateBoardRow={selectedCandidateBoardRow}
          stageDraft=""
          stageComment=""
          isStageSaving={false}
          decisionMessage=""
          onStageDraftChange={() => undefined}
          onStageCommentChange={() => undefined}
          onAdvanceStage={async () => undefined}
          onLicenseUpdated={onLicenseUpdated}
          onInterviewNotesUpdated={onInterviewNotesUpdated}
          onCandidateFileUpdated={onCandidateFileUpdated}
        />
      </div>
      <TrackingPagination
        page={page}
        pageSize={PERSONNEL_PAGE_SIZE}
        totalCount={totalCount}
        label="Personal visible"
        onPageChange={setPage}
      />
      {showBukActions && personnelToHire.length > 0 ? (
        <p className="tracking-filter-caption">
          {visibleSelectedCount} seleccionado(s) en la página actual · {selectedPersonnel.length} total para exportar
        </p>
      ) : null}
    </>
  );
}
