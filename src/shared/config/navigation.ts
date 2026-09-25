import type { AppModuleCode, AppRole } from "../../modules/auth/config/access";

export const homeNavigationItem = {
  to: "/",
  label: "Inicio",
  iconKey: "home" as const
};

export type NavigationIconKey =
  | "home"
  | "users"
  | "heart-pulse"
  | "bus"
  | "chart-pie"
  | "user-plus"
  | "arrow-right-left"
  | "clipboard-list"
  | "brain"
  | "user-check"
  | "calendar-clock"
  | "wallet"
  | "coins"
  | "gavel"
  | "id-card"
  | "award"
  | "gauge"
  | "route"
  | "sparkles"
  | "download"
  | "trending-up";

export type NavigationItem = {
  moduleCode: AppModuleCode;
  to: string;
  label: string;
  description?: string;
  subgroup?: string;
  iconKey?: NavigationIconKey;
  visibleForRoles?: AppRole[];
  items?: NavigationItem[];
};

export type NavigationModule = {
  label: string;
  iconKey: NavigationIconKey;
  moduleCode?: AppModuleCode;
  to?: string;
  items?: NavigationItem[];
  visibleForRoles?: AppRole[];
};

export const navigationModules: NavigationModule[] = [
  {
    label: "Reclutamiento",
    iconKey: "users",
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
        moduleCode: "gestion_psicolaboral",
        to: "/gestion-psicolaboral",
        label: "Gestión Psicolaboral",
        description: "Envía baterías, supervisa ejecución y registra la decisión psicolaboral.",
        iconKey: "brain"
      },
      {
        moduleCode: "alta_operacional_personal",
        to: "/alta-operacional",
        label: "Onboarding",
        description: "Configura las plantillas de alta operacional.",
        iconKey: "user-check",
        visibleForRoles: ["admin"]
      }
    ]
  },
  {
    label: "Recursos Humanos",
    iconKey: "heart-pulse",
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
        moduleCode: "control_estructuras_renta",
        to: "/recursos-humanos/estructuras-renta",
        label: "Control Estructuras de Renta",
        description: "Consulta la estructura y el presupuesto por cargo habilitado en BUK.",
        iconKey: "coins",
        visibleForRoles: [
          "admin",
          "control_contratos",
          "gerencia",
          "director_eje",
          "director_op",
          "gerente_general"
        ]
      },
      {
        moduleCode: "solicitud_sanciones",
        to: "/recursos-humanos/sanciones",
        label: "Solicitud de Sanciones",
        description: "Ingreso, revisión y cierre trazable de sanciones disciplinarias.",
        iconKey: "gavel",
        visibleForRoles: ["admin"]
      },
      {
        moduleCode: "acreditacion_personas",
        to: "/recursos-humanos/acreditacion/dashboard",
        label: "Acreditación de Personas",
        description: "Matriz documental, vigencias y estado operacional por trabajador.",
        iconKey: "id-card"
      },
      {
        moduleCode: "certificados",
        to: "/certificados",
        label: "Certificación de Competencias",
        description: "Emisión y seguimiento de competencias de conductores con carga a BUK.",
        iconKey: "award"
      }
    ]
  },
  {
    label: "Operaciones",
    iconKey: "bus",
    items: [
      {
        moduleCode: "operaciones",
        to: "/operaciones/resumen",
        label: "Resumen",
        description: "Vista general y métricas operacionales.",
        iconKey: "gauge"
      },
      {
        moduleCode: "operaciones",
        to: "/operaciones/registros-base",
        label: "Registro de servicios base",
        description: "Planificación de servicios por contrato.",
        iconKey: "route"
      },
      {
        moduleCode: "operaciones",
        to: "/operaciones/registros-especiales",
        label: "Registro de servicios especiales",
        description: "Gestión de requerimientos no programados.",
        iconKey: "sparkles"
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
    iconKey: "chart-pie",
    moduleCode: "bi_analytics",
    to: "/bi/dotacion"
  }
];
