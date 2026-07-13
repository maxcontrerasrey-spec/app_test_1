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
