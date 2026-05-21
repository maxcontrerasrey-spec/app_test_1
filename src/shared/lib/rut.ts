const MAX_RUT_LENGTH = 9;

export function sanitizeRut(value: string | null | undefined) {
  return (value ?? "")
    .replace(/[^0-9kK]/g, "")
    .toUpperCase()
    .slice(0, MAX_RUT_LENGTH);
}

export function normalizeRut(value: string | null | undefined) {
  return sanitizeRut(value);
}

export function formatRut(value: string | null | undefined) {
  const sanitized = sanitizeRut(value);

  if (sanitized.length <= 1) {
    return sanitized;
  }

  const body = sanitized.slice(0, -1);
  const verifier = sanitized.slice(-1);
  const formattedBody = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  return `${formattedBody}-${verifier}`;
}

export function validateRut(value: string | null | undefined) {
  const normalized = normalizeRut(value);

  if (normalized.length < 2) {
    return false;
  }

  const body = normalized.slice(0, -1);
  const verifier = normalized.slice(-1);

  if (!/^\d+$/.test(body) || !/^[\dK]$/.test(verifier)) {
    return false;
  }

  let sum = 0;
  let multiplier = 2;

  for (let index = body.length - 1; index >= 0; index -= 1) {
    sum += Number(body[index]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const remainder = 11 - (sum % 11);
  const expectedVerifier =
    remainder === 11 ? "0" : remainder === 10 ? "K" : String(remainder);

  return verifier === expectedVerifier;
}
