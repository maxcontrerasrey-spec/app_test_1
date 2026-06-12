import type { AppModuleCode } from "../../modules/auth/config/access";

export const homeNavigationItem = {
  to: "/",
  label: "Inicio"
};

export type NavigationItem = {
  moduleCode: AppModuleCode;
  to: string;
  label: string;
  description?: string;
  iconKey?: "document" | "timeline" | "certificate" | "tracking";
};

export type NavigationModule = {
  label: string;
  moduleCode?: AppModuleCode;
  to?: string;
  items?: NavigationItem[];
  adminOnly?: boolean;
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
        iconKey: "document"
      },
      {
        moduleCode: "movilidad_interna",
        to: "/movilidad-interna",
        label: "Movilidad Interna",
        description: "Solicita traslados internos de trabajadores activos.",
        iconKey: "document"
      },
      {
        moduleCode: "control_contrataciones",
        to: "/control-contrataciones",
        label: "Control de Contrataciones",
        description: "Revisa y administra folios y seguimiento.",
        iconKey: "timeline"
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
        iconKey: "tracking"
      },
      {
        moduleCode: "operaciones",
        to: "/operaciones/registros-base",
        label: "Registro de servicios base",
        description: "Planificación de servicios por contrato.",
        iconKey: "document"
      },
      {
        moduleCode: "operaciones",
        to: "/operaciones/registros-especiales",
        label: "Registro de servicios especiales",
        description: "Gestión de requerimientos no programados.",
        iconKey: "document"
      },
      {
        moduleCode: "operaciones",
        to: "/operaciones/exportador",
        label: "Exportador de Información",
        description: "Descarga reportes operacionales detallados.",
        iconKey: "certificate"
      }
    ]
  },
  {
    label: "Recursos Humanos",
    items: [
      {
        moduleCode: "recursos_humanos",
        to: "/recursos-humanos/incentivos",
        label: "Incentivos",
        description: "Registro y control de incentivos extraordinarios.",
        iconKey: "document"
      }
    ]
  },
  {
    label: "Labs",
    adminOnly: true,
    items: [
      {
        moduleCode: "operaciones", // Can be anything or omitted if adminOnly handles it, but using existing code to pass types
        to: "/labs",
        label: "NXTPAPER Test",
        description: "Entorno de pruebas para la simulación visual E-Ink.",
        iconKey: "flask" as any
      }
    ]
  }
];
