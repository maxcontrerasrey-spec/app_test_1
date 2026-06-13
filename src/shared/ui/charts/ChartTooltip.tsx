import type { ReactNode } from "react";
import type { TooltipContentProps, TooltipPayloadEntry, TooltipValueType } from "recharts";

type ChartTooltipProps = TooltipContentProps<TooltipValueType, string | number> & {
  chartLabelFormatter?: (label: string | number) => ReactNode;
  chartValueFormatter?: (value: TooltipValueType | undefined, name: string | number | undefined) => ReactNode;
};

function fallbackValueFormatter(value: TooltipValueType | undefined) {
  if (Array.isArray(value)) {
    return value.join(" - ");
  }

  return value ?? "—";
}

export function ChartTooltip({
  active,
  payload,
  label,
  chartLabelFormatter,
  chartValueFormatter = fallbackValueFormatter
}: ChartTooltipProps) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="chart-tooltip">
      {label !== undefined ? (
        <div className="chart-tooltip-title">
          {chartLabelFormatter ? chartLabelFormatter(label) : label}
        </div>
      ) : null}
      <div className="chart-tooltip-list">
        {payload.map((entry: TooltipPayloadEntry) => (
          <div key={`${entry.name}-${entry.dataKey}`} className="chart-tooltip-item">
            <span className="chart-tooltip-item-label">
              <span
                className="chart-tooltip-item-dot"
                style={{ backgroundColor: entry.color ?? "var(--primary)" }}
              />
              {entry.name}
            </span>
            <strong>{chartValueFormatter(entry.value, entry.name)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
