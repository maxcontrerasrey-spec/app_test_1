import { useEffect, useMemo, useState } from "react";
import { TextField } from "../../../shared/ui";
import {
  fetchCandidateBukProfile,
  formatRut,
  generateCandidatesInBuk,
  type RecruitmentCaseDetail,
  type RecruitmentPersonnelToHireRow
} from "../services/hiringControl";
import { formatDateTimeValue } from "./hiringControlViewUtils";
import { CandidateDetailSidebar } from "./CandidateDetailSidebar";
import { exportBukNominaXls } from "../lib/bukEmployeeNomina";

type HiringPersonnelToHireViewProps = {
  isLoading: boolean;
  errorMessage: string;
  personnelToHire: RecruitmentPersonnelToHireRow[];
  selectedCandidateId: string;
  selectedCaseDetail: RecruitmentCaseDetail | null;
  onSelectCandidate: (candidateId: string, caseId: string) => void;
  onLicenseUpdated: () => Promise<void>;
  onInterviewNotesUpdated: () => Promise<void>;
  onCandidateFileUpdated: () => Promise<void>;
};

export function HiringPersonnelToHireView({
  isLoading,
  errorMessage,
  personnelToHire,
  selectedCandidateId,
  selectedCaseDetail,
  onSelectCandidate,
  onLicenseUpdated,
  onInterviewNotesUpdated,
  onCandidateFileUpdated
}: HiringPersonnelToHireViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [isGeneratingBuk, setIsGeneratingBuk] = useState(false);
  const [exportMessage, setExportMessage] = useState("");

  const filteredPersonnel = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return personnelToHire.filter((candidate) => {
      if (!normalizedSearch) {
        return true;
      }

      return [
        candidate.full_name,
        candidate.national_id,
        candidate.case_code,
        candidate.contract_name,
        candidate.job_position_name,
        candidate.folio ?? "",
        candidate.owner_name ?? ""
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [personnelToHire, searchTerm]);

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
    filteredPersonnel.length > 0 &&
    filteredPersonnel.every((candidate) => selectedCandidateIds.includes(candidate.id));

  const visibleSelectedCount = filteredPersonnel.filter((candidate) =>
    selectedCandidateIds.includes(candidate.id)
  ).length;

  useEffect(() => {
    setSelectedCandidateIds((current) =>
      current.filter((candidateId) => personnelToHire.some((candidate) => candidate.id === candidateId))
    );
  }, [personnelToHire]);

  const toggleCandidateSelection = (candidateId: string) => {
    setSelectedCandidateIds((current) =>
      current.includes(candidateId)
        ? current.filter((id) => id !== candidateId)
        : [...current, candidateId]
    );
  };

  const toggleSelectAllFiltered = () => {
    const filteredIds = filteredPersonnel.map((candidate) => candidate.id);

    setSelectedCandidateIds((current) => {
      if (filteredIds.every((id) => current.includes(id))) {
        return current.filter((id) => !filteredIds.includes(id));
      }

      return Array.from(new Set([...current, ...filteredIds]));
    });
  };

  const handleExportNomina = async () => {
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
        ? `BUK procesó ${successCount} persona(s) correctamente y ${failedJobs.length} fallaron. ${failedJobs
            .map((job) => job.error)
            .filter(Boolean)
            .join(" | ")}`
        : processingCount > 0
          ? `BUK procesó ${successCount} persona(s). ${processingCount} ya estaban en procesamiento.`
          : `BUK procesó ${successCount} persona(s) correctamente.`
    );
    setIsGeneratingBuk(false);
  };

  // Comportamiento actualizado: no autoseleccionar candidato.

  return (
    <>
      <div className="tracking-toolbar">
        <div className="tracking-toolbar-copy">
          <h3>Personal a Contratar</h3>
          <span className="tracking-filter-caption">
            {errorMessage || "Candidatos contratados listos para revisar ficha y documentación final."}
          </span>
        </div>
        <div className="tracking-filters tracking-filters-inline">
          <TextField
            id="hiring-personnel-search"
            label="Buscar personal"
            value={searchTerm}
            placeholder="Buscar por candidato, RUT, caso, contrato o aprobador"
            onChange={(event) => setSearchTerm(event.target.value)}
            className="tracking-search-field"
          />
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
                  <th className="tracking-selection-cell">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      aria-label="Seleccionar personal filtrado"
                      onChange={toggleSelectAllFiltered}
                    />
                  </th>
                  <th>Candidato</th>
                  <th>Caso</th>
                  <th>Cargo</th>
                  <th>Contrato</th>
                  <th>Fecha contratación</th>
                  <th>Owner</th>
                </tr>
              </thead>
              <tbody>
                {filteredPersonnel.length > 0 ? (
                  filteredPersonnel.map((candidate) => (
                    <tr
                      key={candidate.id}
                      className={
                        candidate.id === selectedCandidateBoardRow?.id ? "tracking-row-selected" : ""
                      }
                      onClick={() => onSelectCandidate(candidate.id, candidate.recruitment_case_id)}
                    >
                      <td className="tracking-selection-cell">
                        <input
                          type="checkbox"
                          checked={selectedCandidateIds.includes(candidate.id)}
                          aria-label={`Seleccionar ${candidate.full_name}`}
                          onClick={(event) => event.stopPropagation()}
                          onChange={() => toggleCandidateSelection(candidate.id)}
                        />
                      </td>
                      <td>
                        <strong>{candidate.full_name}</strong>
                        <div className="tracking-filter-caption">
                          {formatRut(candidate.national_id)}
                        </div>
                      </td>
                      <td>{candidate.case_code}</td>
                      <td>{candidate.job_position_name}</td>
                      <td>{candidate.contract_name}</td>
                      <td>{formatDateTimeValue(candidate.hired_at ?? candidate.stage_entered_at)}</td>
                      <td>{candidate.owner_name ?? "No asignado"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="tracking-empty-state" colSpan={7}>
                      {isLoading
                        ? "Cargando personal..."
                        : "No hay personas contratadas para el filtro actual."}
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
      {filteredPersonnel.length > 0 ? (
        <p className="tracking-filter-caption">
          {visibleSelectedCount} seleccionado(s) en el filtro actual · {selectedPersonnel.length} total para exportar
        </p>
      ) : null}
    </>
  );
}
