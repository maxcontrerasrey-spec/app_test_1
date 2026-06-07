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
        moduleCode: "control_contrataciones",
        to: "/control-contrataciones",
        label: "Control de Contrataciones",
        description: "Revisa y administra folios y seguimiento.",
        iconKey: "timeline"
      },
      {
        moduleCode: "certificados",
        to: "/certificados",
        label: "Generador de Certificados - Competencias",
        description: "Genera certificados operativos por competencias.",
        iconKey: "certificate"
      },
      {
        moduleCode: "seguimiento_certificados",
        to: "/seguimiento-certificados",
        label: "Seguimiento de Certificados",
        description: "Consulta estados y trazabilidad de certificados.",
        iconKey: "tracking"
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
  }
];
