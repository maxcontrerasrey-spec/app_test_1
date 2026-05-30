import { formatDateValue, parseDateValue } from "../../../shared/lib/date";
import type {
  DashboardEntryRow,
  DashboardSummary,
  Driver,
  EmployeeActiveRow,
  Equipment,
  EquipmentDirectoryRow,
  OperationsServiceRecord
} from "../types";

const WEEKDAY_NAMES = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];

type PagedQueryResult<T> = PromiseLike<{
  data: T[] | null;
  error: unknown;
}>;

export function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .toString()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function matchesSchedule(normalizedSchedule: string, date: Date | null): boolean {
  if (!date || !normalizedSchedule) return true;
  const weekday = date.getDay();
  if (normalizedSchedule === "lunes a domingo") return true;
  if (normalizedSchedule === "lunes a jueves") return weekday >= 1 && weekday <= 4;
  if (normalizedSchedule === "lunes a viernes") return weekday >= 1 && weekday <= 5;
  return normalizedSchedule.includes(WEEKDAY_NAMES[weekday]);
}

export function enumerateDateRange(startValue: string, endValue: string): string[] {
  if (!startValue || !endValue || startValue > endValue) return [];

  const startDate = parseDateValue(startValue);
  const endDate = parseDateValue(endValue);

  if (!startDate || !endDate || startDate > endDate) return [];

  const dates: string[] = [];
  const cursor = new Date(startDate);

  while (cursor <= endDate && dates.length < 400) {
    dates.push(formatDateValue(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

export async function fetchAllPagedRows<T>({
  pageSize,
  buildQuery
}: {
  pageSize: number;
  buildQuery: (from: number, to: number) => PagedQueryResult<T>;
}) {
  const rows: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await buildQuery(from, from + pageSize - 1);

    if (error) {
      throw error;
    }

    if (!data?.length) {
      break;
    }

    rows.push(...data);

    if (data.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return rows;
}

export function buildDriverDirectory(rows: EmployeeActiveRow[]): Driver[] {
  const grouped = new Map<string, Driver>();

  for (const employee of rows) {
    if (!employee.full_name) continue;

    const key = `${employee.document_number || "sin-documento"}::${normalizeText(employee.full_name)}`;
    const current = grouped.get(key);
    const candidate: Driver = {
      id: employee.buk_employee_id,
      fullName: employee.full_name,
      documentNumber: employee.document_number ?? "",
      areaName: employee.area_name ?? "",
      areaCode: employee.area_code ?? "",
      isActive: employee.is_active !== false
    };

    if (!current) {
      grouped.set(key, candidate);
      continue;
    }

    const currentScore =
      (current.isActive ? 100 : 0) +
      (current.areaName ? 10 : 0) +
      (current.documentNumber ? 5 : 0);
    const candidateScore =
      (candidate.isActive ? 100 : 0) +
      (candidate.areaName ? 10 : 0) +
      (candidate.documentNumber ? 5 : 0);

    if (candidateScore > currentScore) {
      grouped.set(key, candidate);
    }
  }

  return [...grouped.values()].sort((left, right) => left.fullName.localeCompare(right.fullName, "es"));
}

export function buildEquipmentDirectory(rows: EquipmentDirectoryRow[]): Equipment[] {
  const grouped = new Map<string, Equipment>();

  for (const row of rows) {
    const code = row.equipment_code.toString().trim();
    if (!code) continue;

    const candidate: Equipment = {
      code,
      plate: (row.plate ?? "").toString().trim(),
      type: (row.equipment_type ?? "").toString().trim(),
      currentClient: (row.current_client ?? "").toString().trim(),
      brand: (row.brand ?? "").toString().trim(),
      model: (row.model ?? "").toString().trim(),
      year: row.year ? String(row.year).trim() : "",
      isActive: row.is_active !== false
    };

    const current = grouped.get(code);
    if (!current) {
      grouped.set(code, candidate);
      continue;
    }

    const currentScore =
      (current.isActive ? 100 : 0) +
      (current.plate ? 10 : 0) +
      (current.type ? 5 : 0);
    const candidateScore =
      (candidate.isActive ? 100 : 0) +
      (candidate.plate ? 10 : 0) +
      (candidate.type ? 5 : 0);

    if (candidateScore > currentScore) {
      grouped.set(code, candidate);
    }
  }

  return [...grouped.values()].sort((left, right) => left.code.localeCompare(right.code, "es"));
}

export function buildDashboardSummary({
  entries,
  servicesData,
  contracts,
  dateRangeValues,
  selectedContract
}: {
  entries: DashboardEntryRow[];
  servicesData: OperationsServiceRecord[];
  contracts: string[];
  dateRangeValues: string[];
  selectedContract: string;
}): DashboardSummary {
  const contractScope = (selectedContract ? [selectedContract] : contracts).filter(Boolean);

  const byContract = contractScope.map((contractCode) => {
    const contractEntries = entries.filter((entry) => entry.contract_code === contractCode);
    const expectedServices = dateRangeValues.reduce((total, dateValue) => {
      const date = dateValue ? parseDateValue(dateValue) : null;
      return (
        total +
        servicesData.filter((service) => service.contract === contractCode && matchesSchedule(service.normalizedSchedule, date)).length
      );
    }, 0);

    const plannedServices = contractEntries.length;
    const inTurnWorkers = new Set(
      contractEntries
        .filter((entry) => entry.driver_shift_status === "en_turno")
        .map((entry) => normalizeText(entry.driver_name))
        .filter(Boolean)
    ).size;
    const outOfTurnWorkers = new Set(
      contractEntries
        .filter((entry) => entry.driver_shift_status === "fuera_de_turno")
        .map((entry) => normalizeText(entry.driver_name))
        .filter(Boolean)
    ).size;

    return {
      contractCode,
      plannedServices,
      expectedServices,
      inTurnWorkers,
      outOfTurnWorkers,
      completionRate: expectedServices > 0 ? Math.round((plannedServices / expectedServices) * 100) : 0
    };
  });

  return byContract.reduce(
    (summary: DashboardSummary, contractSummary) => {
      summary.byContract.push(contractSummary);
      summary.totalPlanned += contractSummary.plannedServices;
      summary.totalExpected += contractSummary.expectedServices;
      summary.totalInTurn += contractSummary.inTurnWorkers;
      summary.totalOutOfTurn += contractSummary.outOfTurnWorkers;
      return summary;
    },
    {
      byContract: [],
      totalPlanned: 0,
      totalExpected: 0,
      totalInTurn: 0,
      totalOutOfTurn: 0
    }
  );
}
