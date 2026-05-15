import type { AppRole } from "../../modules/auth/config/access";

export const homeNavigationItem = {
  to: "/",
  label: "Inicio"
};

export type NavigationItem = {
  to: string;
  label: string;
  allowedRoles: AppRole[];
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
        to: "/solicitud-contrataciones",
        label: "Solicitud de Contrataciones",
        allowedRoles: ["admin", "reclutamiento"]
      },
      {
        to: "/control-contrataciones",
        label: "Control de Contrataciones",
        allowedRoles: ["admin", "reclutamiento", "control_contratos"]
      },
      {
        to: "/certificados",
        label: "Generador de Certificados - Competencias",
        allowedRoles: ["admin", "certificaciones", "instructor"]
      },
      {
        to: "/seguimiento-certificados",
        label: "Seguimiento de Certificados",
        allowedRoles: ["admin", "certificaciones", "instructor"]
      }
    ]
  }
];
