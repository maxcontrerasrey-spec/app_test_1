import { formatCurrencyValue } from "../../../shared/lib/format";
import type { HrIncentiveRosterSnapshot } from "../types";

export function buildAreaOptionValue(
  contractCode: string | null,
  areaCode: string | null,
  areaName: string | null
) {
  return [contractCode ?? "", areaCode ?? "", areaName ?? ""].join("::");
}

export function resolveRosterStatusAppearance(snapshot: HrIncentiveRosterSnapshot | null) {
  if (!snapshot) {
    return null;
  }

  if (snapshot.blockedByAbsence) {
    return {
      tone: "danger" as const,
      title: snapshot.scheduleLabel ?? "Vacaciones o licencia médica",
      description: "El sistema bloqueará el registro mientras este estado siga vigente."
    };
  }

  if (snapshot.isRestDay) {
    return {
      tone: "warning" as const,
      title: "En descanso",
      description: "Si registras el incentivo, el calendario operativo quedará marcado como turno adicional."
    };
  }

  if (snapshot.scheduleStatus === "working" || snapshot.scheduleStatus === "extra_shift") {
    return {
      tone: "success" as const,
      title: snapshot.scheduleStatus === "extra_shift" ? "Turno adicional" : "En turno",
      description: "El trabajador figura operativo para la fecha seleccionada."
    };
  }

  if (snapshot.scheduleStatus === "training") {
    return {
      tone: "success" as const,
      title: "Capacitación",
      description: "El trabajador tiene una excepción operativa activa para esa fecha."
    };
  }

  return {
    tone: "neutral" as const,
    title: snapshot.scheduleLabel ?? "Sin pauta",
    description: "No existe una pauta operativa concluyente para la fecha seleccionada."
  };
}

export function isReplacementWorkerEligible(snapshot: HrIncentiveRosterSnapshot | null) {
  if (!snapshot) {
    return false;
  }

  return snapshot.scheduleStatus === "working" || snapshot.scheduleStatus === "extra_shift";
}

export function buildHourlyRateBreakdownCopy(params: {
  hourRateStrategy: "rule_amount" | "buk_overtime";
  rateSource: "rule_amount" | "buk_payload" | "rule_fallback_salary";
  rateRuleAmount: number;
  rateBaseSalary: number | null;
  rateWeeklyHours: number | null;
  rateOvertimeMultiplier: number | null;
}) {
  const {
    hourRateStrategy,
    rateSource,
    rateRuleAmount,
    rateBaseSalary,
    rateWeeklyHours,
    rateOvertimeMultiplier
  } = params;

  if (hourRateStrategy !== "buk_overtime") {
    return null;
  }

  if (rateSource === "buk_payload" && rateBaseSalary !== null && rateWeeklyHours !== null) {
    return `Valor hora extra calculado desde BUK: ${formatCurrencyValue(rateRuleAmount)} (${formatCurrencyValue(rateBaseSalary)} base / ${rateWeeklyHours} hrs semanales x ${rateOvertimeMultiplier ?? 1.5}).`;
  }

  if (
    rateSource === "rule_fallback_salary" &&
    rateBaseSalary !== null &&
    rateWeeklyHours !== null
  ) {
    return `Valor hora extra calculado desde fallback configurado: ${formatCurrencyValue(rateRuleAmount)} (${formatCurrencyValue(rateBaseSalary)} base / ${rateWeeklyHours} hrs semanales x ${rateOvertimeMultiplier ?? 1.5}).`;
  }

  return `No hubo datos salariales suficientes en BUK; se aplicó el valor hora de respaldo definido en la regla: ${formatCurrencyValue(rateRuleAmount)}.`;
}
