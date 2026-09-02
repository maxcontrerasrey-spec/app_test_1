export function monthInputToPeriodCode(value: string) {
  return value.replace(/[^0-9]/g, "");
}

export function buildBiPeriodCode(from: string, to: string) {
  const start = monthInputToPeriodCode(from);
  const end = monthInputToPeriodCode(to);

  if (!start) return undefined;
  if (!end || start === end) return start;
  return `${start}-${end}`;
}

export function isBiPeriodRangeValid(from: string, to: string) {
  return !from || !to || from <= to;
}
