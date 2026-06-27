import { SoftSurface } from "./SoftSurface";

type SoftMetricTone = "danger" | "info" | "neutral" | "success" | "warning";

type SoftMetricCardProps = {
  className?: string;
  detail?: string | null;
  label: string;
  tone?: SoftMetricTone;
  value: string;
};

export function SoftMetricCard({
  className = "",
  detail,
  label,
  tone = "neutral",
  value
}: SoftMetricCardProps) {
  return (
    <SoftSurface
      as="article"
      className={`soft-metric-card soft-metric-card--${tone} ${className}`.trim()}
      density="compact"
      variant="raised"
    >
      <span className="soft-metric-card__label">{label}</span>
      <strong className="soft-metric-card__value">{value}</strong>
      {detail ? <span className="soft-metric-card__detail">{detail}</span> : null}
    </SoftSurface>
  );
}
