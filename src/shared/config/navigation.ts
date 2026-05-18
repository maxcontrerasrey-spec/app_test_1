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
    moduleCode: "operaciones",
    to: "/operaciones"
  },
  {
    label: "Recursos Humanos",
    moduleCode: "recursos_humanos",
    to: "/recursos-humanos"
  }
];
