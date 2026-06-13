import { formatDateValue, monthOptions, parseDateValue, toTodayDateValue } from "../../../shared/lib/date";

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function shiftDateValue(dateValue: string, days: number) {
  const nextDate = parseDateValue(dateValue);
  nextDate.setDate(nextDate.getDate() + days);
  return formatDateValue(nextDate);
}

export function resolveIncentivePeriodCode(dateValue: string) {
  if (!dateValue) {
    return "";
  }

  const serviceDate = parseDateValue(dateValue);
  const anchorDate =
    serviceDate.getDate() >= 21
      ? new Date(serviceDate.getFullYear(), serviceDate.getMonth() + 1, 1)
      : serviceDate;

  return `${anchorDate.getFullYear()}${String(anchorDate.getMonth() + 1).padStart(2, "0")}`;
}

export function resolveIncentivePeriodLabel(periodCode: string) {
  if (!/^\d{6}$/.test(periodCode)) {
    return "";
  }

  const year = Number(periodCode.slice(0, 4));
  const monthIndex = Number(periodCode.slice(4, 6)) - 1;

  if (monthIndex < 0 || monthIndex > 11) {
    return periodCode;
  }

  return `${monthOptions[monthIndex]} ${year}`;
}

export function resolveIncentiveEntryLagDays(
  serviceDateValue: string,
  referenceDateValue = toTodayDateValue()
) {
  if (!serviceDateValue) {
    return 0;
  }

  const serviceDate = startOfDay(parseDateValue(serviceDateValue));
  const referenceDate = startOfDay(parseDateValue(referenceDateValue));
  const diffMs = referenceDate.getTime() - serviceDate.getTime();

  return diffMs > 0 ? Math.floor(diffMs / 86400000) : 0;
}

export function resolveIncentiveRegistrationWindow(
  serviceDateValue: string,
  referenceDateValue = toTodayDateValue()
) {
  const entryLagDays = resolveIncentiveEntryLagDays(serviceDateValue, referenceDateValue);

  return {
    entryLagDays,
    isOutOfDeadline: entryLagDays > 2,
    isAllowed: entryLagDays <= 7,
    periodCode: resolveIncentivePeriodCode(serviceDateValue),
    minimumDateValue: shiftDateValue(referenceDateValue, -7),
    maximumDateValue: referenceDateValue
  };
}

export function resolveIncentiveContractMismatch(
  primaryContractCode: string | null | undefined,
  selectedContractCode: string | null | undefined
) {
  const normalizedPrimary = primaryContractCode?.trim() ?? "";
  const normalizedSelected = selectedContractCode?.trim() ?? "";

  return Boolean(normalizedPrimary) && Boolean(normalizedSelected) && normalizedPrimary !== normalizedSelected;
}
