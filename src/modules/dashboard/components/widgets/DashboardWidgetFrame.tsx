import type { ReactNode } from "react";

type DashboardWidgetFrameProps = {
  title: string;
  className?: string;
  children: ReactNode;
};

export function DashboardWidgetFrame({
  title,
  className = "",
  children
}: DashboardWidgetFrameProps) {
  return (
    <article className={`widget-card ${className}`.trim()}>
      <div className="widget-header">
        <h3 className="widget-title">{title}</h3>
      </div>
      {children}
    </article>
  );
}
