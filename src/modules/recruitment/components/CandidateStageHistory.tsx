import { toRecruitmentCandidateStageLabel, type RecruitmentCaseCandidateRow } from "../services/hiringControl";
import { formatDateTimeValue } from "./hiringControlViewUtils";

export function CandidateStageHistory({
  entries,
  expanded,
  onToggle
}: {
  entries: RecruitmentCaseCandidateRow["stage_history"];
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="approval-detail-note control-block-top-lg">
      <div className="control-inline-header">
        <small>Historial de etapa</small>
        <button type="button" onClick={onToggle} className="control-inline-button">
          {expanded ? "Contraer ▲" : `Ver historial (${entries.length}) ▼`}
        </button>
      </div>

      {expanded ? (
        <div className="control-history-scroll">
          {entries.length > 0 ? (
            entries.map((entry, index) => (
              <div
                key={index}
                className={`control-history-entry${index < entries.length - 1 ? " has-divider" : ""}`}
              >
                <strong className="control-history-entry-title">
                  {toRecruitmentCandidateStageLabel(entry.to_stage)}
                </strong>
                <span className="control-history-entry-meta">{formatDateTimeValue(entry.created_at)}</span>
                {entry.comment ? <p className="control-history-entry-comment">"{entry.comment}"</p> : null}
              </div>
            ))
          ) : (
            <span className="control-history-empty">Sin historial adicional</span>
          )}
        </div>
      ) : null}
    </div>
  );
}
