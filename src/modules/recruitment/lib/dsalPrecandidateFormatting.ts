export function normalizeDsalDisplayText(value: string | null | undefined) {
  return (value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("es-CL")
    .replace(/\p{L}[\p{L}\p{M}]*/gu, (word) => {
      const firstCharacter = word.charAt(0).toLocaleUpperCase("es-CL");
      return `${firstCharacter}${word.slice(1)}`;
    });
}

export function normalizeDsalEmail(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/,([a-z]{2,})$/i, ".$1");
}

export function isValidDsalEmail(value: string | null | undefined) {
  const normalized = normalizeDsalEmail(value);
  return /^[^\s@]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/.test(
    normalized
  );
}

export function normalizeDsalPhoneDigits(value: string | null | undefined) {
  const digits = (value ?? "").replace(/\D/g, "");
  const localDigits = digits.startsWith("569") ? digits.slice(3) : digits;
  return localDigits.slice(0, 8);
}

export function normalizeDsalPhone(value: string | null | undefined) {
  const digits = normalizeDsalPhoneDigits(value);
  return digits.length === 8 ? `+569${digits}` : "";
}
