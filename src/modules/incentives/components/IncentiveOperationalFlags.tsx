import { resolveIncentivePeriodLabel } from "../lib/incentiveRules";

type IncentiveOperationalFlagsProps = {
  periodCode: string;
  entryLagDays?: number;
  isOutOfDeadline?: boolean;
  isContractMismatch?: boolean;
  declaredRestDay?: boolean | null;
  compact?: boolean;
};

export function IncentiveOperationalFlags({
  periodCode,
  entryLagDays = 0,
  isOutOfDeadline = false,
  isContractMismatch = false,
  compact = false
}: IncentiveOperationalFlagsProps) {
  const periodLabel = resolveIncentivePeriodLabel(periodCode);

  return (
    <div
      className={`hr-incentive-flag-list${compact ? " hr-incentive-flag-list-compact" : ""}`}
    >
      {periodCode ? (
        <span className="hr-incentive-flag-pill hr-incentive-flag-pill-period">
          Período {periodCode}
          {periodLabel ? ` · ${periodLabel}` : ""}
        </span>
      ) : null}
      {isOutOfDeadline ? (
        <span className="hr-incentive-flag-pill hr-incentive-flag-pill-late">
          Fuera de Plazo · {entryLagDays} día(s)
        </span>
      ) : null}
      {isContractMismatch ? (
        <span className="hr-incentive-flag-pill hr-incentive-flag-pill-contract">
          Contrato distinto
        </span>
      ) : null}
    </div>
  );
}
