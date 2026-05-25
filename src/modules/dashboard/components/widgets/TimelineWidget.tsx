import type { ResolvedWidget } from "../../types";
import { DashboardWidgetFrame } from "./DashboardWidgetFrame";

export function TimelineWidget({ widget }: { widget: ResolvedWidget }) {
  return (
    <DashboardWidgetFrame title={widget.name} className="widget-timeline widget-fill-height">
      <div className="nx-timeline">
        <div className="nx-time-item">
          <div className="nx-time-dot nx-time-dot-success"></div>
          <div className="nx-time-content">
            <p className="nx-time-date">Hace 15 min</p>
            <p className="nx-time-text"><strong>Folio REQ-0041</strong> fue aprobado por Operaciones.</p>
          </div>
        </div>
        <div className="nx-time-item">
          <div className="nx-time-dot nx-time-dot-accent"></div>
          <div className="nx-time-content">
            <p className="nx-time-date">Hace 2 horas</p>
            <p className="nx-time-text">Sistema generó <strong>45 pases de ingreso</strong> automáticamente.</p>
          </div>
        </div>
        <div className="nx-time-item">
          <div className="nx-time-dot nx-time-dot-warning"></div>
          <div className="nx-time-content">
            <p className="nx-time-date">Ayer, 16:30</p>
            <p className="nx-time-text"><strong>Alerta SLA:</strong> Proceso de firmas superó el umbral de 48h.</p>
          </div>
        </div>
      </div>
    </DashboardWidgetFrame>
  );
}
