export function normalizeCandidateEmail(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/,([a-z]{2,})$/i, ".$1");
}

export function isValidCandidateEmail(value: string | null | undefined) {
  const normalized = normalizeCandidateEmail(value);

  if (!normalized) {
    return false;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalized);
}

export function validateOptionalCandidateEmail(value: string | null | undefined) {
  const normalized = normalizeCandidateEmail(value);

  return {
    normalized,
    isValid: !normalized || isValidCandidateEmail(normalized)
  };
}

export function getCandidateEmailValidationMessage(
  label: string,
  value: string | null | undefined
) {
  const rawValue = (value ?? "").trim();

  if (!rawValue || isValidCandidateEmail(rawValue)) {
    return "";
  }

  return `${label} no tiene un formato valido. Debe incluir usuario, @ y dominio, por ejemplo nombre@dominio.com. Revisa espacios, comas o puntos mal ubicados.`;
}
