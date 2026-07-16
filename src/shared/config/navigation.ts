import type { AppModuleCode, AppRole } from "../../modules/auth/config/access";

export const homeNavigationItem = {
  to: "/",
  label: "Inicio"
};

export type NavigationItem = {
  moduleCode: AppModuleCode;
  to: string;
  label: string;
  description?: string;
  subgroup?: string;
  iconKey?: "document" | "certificate" | "user-plus" | "arrow-right-left" | "clipboard-list" | "bar-chart" | "briefcase" | "zap" | "download" | "calendar-clock" | "wallet" | "trending-up" | "badge-check" | "handshake";
  visibleForRoles?: AppRole[];
  items?: NavigationItem[];
};

export type NavigationModule = {
  label: string;
  moduleCode?: AppModuleCode;
  to?: string;
  items?: NavigationItem[];
  visibleForRoles?: AppRole[];
};

export const navigationModules: NavigationModule[] = [
  {
    label: "Reclutamiento",
    items: [
      {
        moduleCode: "solicitud_contrataciones",
        to: "/solicitud-contrataciones",
        label: "Solicitud de Contrataciones",
        description: "Crea y envía requerimientos para aprobación.",
        iconKey: "user-plus"
      },
      {
        moduleCode: "movilidad_interna",
        to: "/movilidad-interna",
        label: "Solicitud de Movilidad Interna",
        description: "Solicita traslados internos de trabajadores activos.",
        iconKey: "arrow-right-left"
      },
      {
        moduleCode: "control_contrataciones",
        to: "/control-contrataciones",
        label: "Control de Contrataciones",
        description: "Revisa y administra folios y seguimiento.",
        iconKey: "clipboard-list"
      },
      {
        moduleCode: "alta_operacional_personal",
        to: "/alta-operacional",
        label: "Onboarding",
        description: "Configura las plantillas de alta operacional.",
        iconKey: "handshake",
        visibleForRoles: ["admin"]
      }
    ]
  },
  {
    label: "Recursos Humanos",
    items: [
      {
        moduleCode: "jornadas_turnos",
        to: "/roster",
        label: "Jornadas y Turnos",
        description: "Calendario operacional de pautas, descansos y excepciones por trabajador.",
        iconKey: "calendar-clock"
      },
      {
        moduleCode: "recursos_humanos",
        to: "/recursos-humanos/incentivos",
        label: "Gestión de Incentivos Extraordinarios",
        description: "Registro y control de incentivos extraordinarios.",
        iconKey: "wallet"
      },
      {
        moduleCode: "acreditacion_personas",
        to: "/recursos-humanos/acreditacion/dashboard",
        label: "Acreditación de Personas",
        description: "Matriz documental, vigencias y estado operacional por trabajador.",
        iconKey: "badge-check"
      },
      {
        moduleCode: "certificados",
        to: "/certificados",
        label: "Certificación de Competencias",
        description: "Emisión y seguimiento de competencias de conductores con carga a BUK.",
        iconKey: "certificate"
      }
    ]
  },
  {
    label: "Operaciones",
    items: [
      {
        moduleCode: "operaciones",
        to: "/operaciones/resumen",
        label: "Resumen",
        description: "Vista general y métricas operacionales.",
        iconKey: "bar-chart"
      },
      {
        moduleCode: "operaciones",
        to: "/operaciones/registros-base",
        label: "Registro de servicios base",
        description: "Planificación de servicios por contrato.",
        iconKey: "briefcase"
      },
      {
        moduleCode: "operaciones",
        to: "/operaciones/registros-especiales",
        label: "Registro de servicios especiales",
        description: "Gestión de requerimientos no programados.",
        iconKey: "zap"
      },
      {
        moduleCode: "operaciones",
        to: "/operaciones/exportador",
        label: "Exportador de Información",
        description: "Descarga reportes operacionales detallados.",
        iconKey: "download"
      }
    ]
  },
  {
    label: "Business Intelligence",
    moduleCode: "bi_analytics",
    to: "/bi/dotacion"
  }
];
