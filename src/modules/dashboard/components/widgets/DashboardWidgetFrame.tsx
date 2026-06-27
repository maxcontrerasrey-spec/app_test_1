import type { ReactNode } from "react";
import { SoftSurface } from "../../../../shared/ui";

type DashboardWidgetFrameProps = {
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
  subtitle?: string;
  title: string;
};

export function DashboardWidgetFrame({
  actions,
  title,
  className = "",
  children,
  subtitle
}: DashboardWidgetFrameProps) {
  return (
    <SoftSurface as="article" className={`widget-card ${className}`.trim()} variant="raised">
      <div className="widget-header">
        <div className="widget-header-copy">
          <h3 className="widget-title">{title}</h3>
          {subtitle ? <p className="widget-subtitle">{subtitle}</p> : null}
        </div>
        {actions ? <div className="widget-header-actions">{actions}</div> : null}
      </div>
      {children}
    </SoftSurface>
  );
}
