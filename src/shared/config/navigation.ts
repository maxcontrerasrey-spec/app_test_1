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

export type NavigationSection = {
  title: string;
  items: NavigationItem[];
};

export const navigationSections: NavigationSection[] = [
  {
    title: "Reclutamiento & Entrenamiento",
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
  }
];
