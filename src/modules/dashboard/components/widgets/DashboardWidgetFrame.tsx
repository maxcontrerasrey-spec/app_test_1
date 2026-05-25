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
        <button className="widget-menu-btn" title="Opciones" type="button">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="1" />
            <circle cx="12" cy="5" r="1" />
            <circle cx="12" cy="19" r="1" />
          </svg>
        </button>
      </div>
      {children}
    </article>
  );
}
