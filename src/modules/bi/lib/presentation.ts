export function formatBiContractLabel(value: string | null | undefined) {
  const rawValue = value?.trim() ?? "";
  if (!rawValue) {
    return "SIN CONTRATO";
  }

  return rawValue.replace(/\s*\([^)]*\)\s*$/, "").trim() || rawValue;
}
