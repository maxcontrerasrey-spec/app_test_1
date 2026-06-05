import { useEffect, useMemo, useState } from "react";
import { TextField } from "../../../shared/ui";
import {
  formatRut,
  type RecruitmentCaseDetail,
  type RecruitmentPersonnelToHireRow
} from "../services/hiringControl";
import { formatDateTimeValue } from "./hiringControlViewUtils";
import { CandidateDetailSidebar } from "./CandidateDetailSidebar";

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
    filteredPersonnel[0] ??
    null;

  const selectedCandidate =
    selectedCaseDetail?.candidates.find((candidate) => candidate.id === selectedCandidateId) ??
    selectedCaseDetail?.candidates.find((candidate) => candidate.stage_code === "hired") ??
    selectedCaseDetail?.candidates[0] ??
    null;

  useEffect(() => {
    if (selectedCandidateBoardRow || filteredPersonnel.length === 0) {
      return;
    }

    const nextCandidate = filteredPersonnel[0];
    onSelectCandidate(nextCandidate.id, nextCandidate.recruitment_case_id);
  }, [filteredPersonnel, onSelectCandidate, selectedCandidateBoardRow]);

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
        </div>
      </div>

      <div className="control-layout">
        <div className="tracking-table-wrap">
          <div className="tracking-table-scroll">
            <table className="tracking-table">
              <thead>
                <tr>
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
                    <td className="tracking-empty-state" colSpan={6}>
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
    </>
  );
}
