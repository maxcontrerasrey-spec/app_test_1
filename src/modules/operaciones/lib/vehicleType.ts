export function getAvailableVehicleTypes(
  vehicles: Array<{ vehicle_type: string | null }>
): string[] {
  const labels = new Map<string, string>();
  for (const vehicle of vehicles) {
    const label = vehicle.vehicle_type?.trim();
    if (!label) continue;
    const key = label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-CL");
    if (!labels.has(key)) labels.set(key, label);
  }
  return [...labels.values()].sort((left, right) => left.localeCompare(right, "es-CL"));
}

export function vehicleTypeMismatch(planned: string | null | undefined, assigned: string | null | undefined): boolean {
  if (!planned?.trim() || !assigned?.trim()) return false;
  const normalize = (value: string) => value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").toLocaleLowerCase("es-CL");
  return normalize(planned) !== normalize(assigned);
}
