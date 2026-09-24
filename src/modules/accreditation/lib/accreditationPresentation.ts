const accreditationStatusLabels: Record<string, string> = {
  approved: "Acreditado",
  expiring_soon: "Por vencer",
  expired: "Vencido",
  pending: "Pendiente",
  rejected: "Rechazado",
  submitted: "Cargado"
};

export function formatAccreditationStatus(status: string) {
  return accreditationStatusLabels[status] ?? status;
}
