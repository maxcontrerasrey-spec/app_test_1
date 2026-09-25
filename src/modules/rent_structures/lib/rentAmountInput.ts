const clpInputFormatter = new Intl.NumberFormat("es-CL", {
  maximumFractionDigits: 0,
  useGrouping: true,
});

export function formatClpInputValue(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "";
  return clpInputFormatter.format(Math.trunc(value));
}

export function parseClpInputValue(value: string): number {
  const digits = value.replace(/\D/g, "");
  if (!digits) return 0;

  const parsed = Number(digits);
  return Number.isSafeInteger(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}
