function normalizeIdentityType(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function normalizeBukDocumentNumber(
  documentType: string | null | undefined,
  documentNumber: string | null | undefined
) {
  const raw = (documentNumber ?? "").trim();
  if (!raw) {
    return "";
  }

  if (normalizeIdentityType(documentType) === "rut") {
    return raw.replace(/[^0-9Kk]/g, "").toUpperCase();
  }

  return raw.toUpperCase();
}
