import type { AppModuleCode } from "../../modules/auth/config/access";

export const homeNavigationItem = {
  to: "/",
  label: "Inicio"
};

export type NavigationItem = {
  moduleCode: AppModuleCode;
  to: string;
  label: string;
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
        label: "Solicitud de Contrataciones"
      },
      {
        moduleCode: "control_contrataciones",
        to: "/control-contrataciones",
        label: "Control de Contrataciones"
      },
      {
        moduleCode: "certificados",
        to: "/certificados",
        label: "Generador de Certificados - Competencias"
      },
      {
        moduleCode: "seguimiento_certificados",
        to: "/seguimiento-certificados",
        label: "Seguimiento de Certificados"
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
