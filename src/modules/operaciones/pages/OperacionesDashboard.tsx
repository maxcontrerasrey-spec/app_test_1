import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../../../shared/lib/supabase";
import { validateServiceEntryPayload } from "../lib/service-entry";
import { submitServiceEntry } from "../services/operacionesApi";
import { SERVICE_DATA, type ServiceDataRecord } from "../data/services-data";
import { useAuth } from "../../auth/context/AuthContext";
import {
  formatDateValue,
  parseDateValue,
  toTodayDateValue,
} from "../../../shared/lib/date";

import { OperationsSummary } from "../components/OperationsSummary";
import { OperationsBaseRegister } from "../components/OperationsBaseRegister";
import { OperationsExport } from "../components/OperationsExport";
import { OperationsSpecialRegister } from "../components/OperationsSpecialRegister";
import "../styles/operaciones.css";

const PILOT_CONTRACTS = ["CODELCO DRT", "SERVICIO CODELCO DMH"];
const WEEKDAY_NAMES = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];

export interface Driver {
  id: string;
  fullName: string;
  documentNumber: string;
  areaName: string;
  areaCode: string;
  isActive: boolean;
}

export interface Equipment {
  code: string;
  plate: string;
  type: string;
  currentClient: string;
  brand?: string;
  model?: string;
  year?: string;
  isActive?: boolean;
}

export interface ServiceDraft {
  driverId: string;
  driverShiftStatus: string;
  equipmentCode: string;
}

export interface ContractSummary {
  contractCode: string;
  plannedServices: number;
  expectedServices: number;
  inTurnWorkers: number;
  outOfTurnWorkers: number;
  completionRate: number;
}

export interface DashboardSummary {
  byContract: ContractSummary[];
  totalPlanned: number;
  totalExpected: number;
  totalInTurn: number;
  totalOutOfTurn: number;
}

export interface OperationsServiceRecord extends ServiceDataRecord {
  normalizedSchedule: string;
}

const SAMPLE_DRIVERS: Driver[] = ["Carlos Rojas", "Juan Araya", "Luis Muñoz", "Pedro Cortés", "Marco Silva", "Héctor Díaz"].map((fullName, index) => ({
  id: `sample-${index + 1}`,
  fullName,
  documentNumber: "",
  areaName: "",
  areaCode: "",
  isActive: true,
}));

const SAMPLE_EQUIPMENT: Equipment[] = ["BUS-042", "BUS-115", "MB-203", "TX-018", "TX-026", "CRY-015"].map((equipmentCode) => ({
  code: equipmentCode,
  plate: "",
  type: "",
  currentClient: "",
}));

const EMPLOYEES_PAGE_SIZE = 1000;
const EXPORT_PAGE_SIZE = 1000;
const DASHBOARD_PAGE_SIZE = 1000;
const DASHBOARD_ENTRY_SELECT = "contract_code, service_date, shift, driver_name, driver_shift_status, service_operational_name";
const EXPORT_ENTRY_SELECT =
  "service_date, shift, contract_code, service_operational_name, service_contractual_name, service_category, service_company, driver_name, driver_document, driver_area, driver_shift_status, equipment_code, equipment_plate, equipment_type, equipment_client, created_at";

function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .toString()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function matchesSchedule(normalizedSchedule: string, date: Date | null): boolean {
  if (!date || !normalizedSchedule) return true;
  const weekday = date.getDay();
  if (normalizedSchedule === "lunes a domingo") return true;
  if (normalizedSchedule === "lunes a jueves") return weekday >= 1 && weekday <= 4;
  if (normalizedSchedule === "lunes a viernes") return weekday >= 1 && weekday <= 5;
  return normalizedSchedule.includes(WEEKDAY_NAMES[weekday]);
}

function enumerateDateRange(startValue: string, endValue: string): string[] {
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

async function fetchAllPagedRows({ pageSize, buildQuery }: { pageSize: number; buildQuery: (from: number, to: number) => any }) {
  const rows: any[] = [];
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

function buildDriverDirectory(rows: any[]): Driver[] {
  const grouped = new Map<string, Driver>();

  for (const employee of rows ?? []) {
    if (!employee?.full_name) continue;

    const key = `${employee.document_number || "sin-documento"}::${normalizeText(employee.full_name)}`;
    const current = grouped.get(key);
    const candidate: Driver = {
      id: employee.buk_employee_id,
      fullName: employee.full_name,
      documentNumber: employee.document_number ?? "",
      areaName: employee.area_name ?? "",
      areaCode: employee.area_code ?? "",
      isActive: employee.is_active !== false,
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

function buildEquipmentDirectory(rows: any[]): Equipment[] {
  const grouped = new Map<string, Equipment>();

  for (const row of rows ?? []) {
    const code = (row?.equipment_code ?? "").toString().trim();
    if (!code) continue;

    const candidate: Equipment = {
      code,
      plate: (row?.plate ?? "").toString().trim(),
      type: (row?.equipment_type ?? "").toString().trim(),
      currentClient: (row?.current_client ?? "").toString().trim(),
      brand: (row?.brand ?? "").toString().trim(),
      model: (row?.model ?? "").toString().trim(),
      year: row?.year ? String(row.year).trim() : "",
      isActive: row?.is_active !== false,
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

function buildDashboardSummary({
  entries,
  servicesData,
  contracts,
  dateRangeValues,
  selectedContract,
}: {
  entries: any[];
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
        .filter(Boolean),
    ).size;
    const outOfTurnWorkers = new Set(
      contractEntries
        .filter((entry) => entry.driver_shift_status === "fuera_de_turno")
        .map((entry) => normalizeText(entry.driver_name))
        .filter(Boolean),
    ).size;

    return {
      contractCode,
      plannedServices,
      expectedServices,
      inTurnWorkers,
      outOfTurnWorkers,
      completionRate: expectedServices > 0 ? Math.round((plannedServices / expectedServices) * 100) : 0,
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
      totalOutOfTurn: 0,
    },
  );
}

const LOCAL_NORMALIZED_DATA: OperationsServiceRecord[] = SERVICE_DATA.map((item) => ({
  ...item,
  normalizedSchedule: normalizeText(item.schedule),
}));

export function OperacionesDashboard() {
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => toTodayDateValue(), []);
  const { session, user } = useAuth();
  const { view } = useParams();
  const activePage = view?.replace("-", "_") || "resumen";

  const [selectedContract, setSelectedContract] = useState("");
  const [selectedShift, setSelectedShift] = useState("");
  const [selectedDateValue, setSelectedDateValue] = useState(todayStr);

  const [dashboardContract, setDashboardContract] = useState("");
  const [dashboardDateFrom, setDashboardDateFrom] = useState(todayStr);
  const [dashboardDateTo, setDashboardDateTo] = useState(todayStr);
  const [dashboardEntries, setDashboardEntries] = useState<any[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState("");

  const [exportContract, setExportContract] = useState("");
  const [exportDateFrom, setExportDateFrom] = useState(todayStr);
  const [exportDateTo, setExportDateTo] = useState(todayStr);
  const [exportRows, setExportRows] = useState<any[]>([]);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState("");
  const [exportSearched, setExportSearched] = useState(false);

  const [servicesData, setServicesData] = useState<OperationsServiceRecord[]>(LOCAL_NORMALIZED_DATA);
  const [serviceDrafts, setServiceDrafts] = useState<Record<number, ServiceDraft>>({});
  const [expandedServiceId, setExpandedServiceId] = useState<number | null>(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  const [userContracts, setUserContracts] = useState<string[]>([]);
  const [isPasswordCardOpen, setIsPasswordCardOpen] = useState(false);

  const [openDriverServiceId, setOpenDriverServiceId] = useState<number | null>(null);
  const [driversData, setDriversData] = useState<Driver[]>(SAMPLE_DRIVERS);
  const [equipmentData, setEquipmentData] = useState<Equipment[]>(SAMPLE_EQUIPMENT);
  const [driverQuery, setDriverQuery] = useState("");
  const [openEquipmentServiceId, setOpenEquipmentServiceId] = useState<number | null>(null);
  const [equipmentQuery, setEquipmentQuery] = useState("");

  const [submitState, setSubmitState] = useState({
    loading: false,
    error: "",
    success: "",
    fieldErrors: {} as Record<string, string>,
    fieldErrorsByService: {} as Record<number, Record<string, string>>,
  });

  const selectedDate = selectedDateValue ? parseDateValue(selectedDateValue) : null;

  const availableContracts = useMemo(() => {
    const currentContracts = new Set(servicesData.map((item) => item.contract).filter(Boolean));
    return PILOT_CONTRACTS.filter((contract) => currentContracts.has(contract));
  }, [servicesData]);
  const contractOptions = userContracts.length > 0 ? userContracts : availableContracts;

  const eligibleServices = useMemo(() => {
    if (!selectedContract || !selectedShift || !selectedDate) return [];
    return servicesData.filter(
      (item) => item.contract === selectedContract && matchesSchedule(item.normalizedSchedule, selectedDate),
    );
  }, [selectedContract, selectedShift, selectedDate, servicesData]);

  const filteredDrivers = useMemo(() => {
    const query = normalizeText(driverQuery);

    if (!query) {
      return driversData;
    }

    const parts = query.split(" ").filter(Boolean);

    return driversData.filter((employee) => {
      const haystack = normalizeText(employee.fullName);
      return parts.every((part) => {
        if (haystack.includes(part)) {
          return true;
        }

        if (part.endsWith("s") && part.length > 4) {
          return haystack.includes(part.slice(0, -1));
        }

        return false;
      });
    });
  }, [driverQuery, driversData]);

  const filteredEquipment = useMemo(() => {
    const query = normalizeText(equipmentQuery);

    if (!query) {
      return equipmentData;
    }

    const parts = query.split(" ").filter(Boolean);

    return equipmentData.filter((item) => {
      const haystack = normalizeText(
        [item.code, item.plate, item.type, item.currentClient, item.brand, item.model, item.year].filter(Boolean).join(" "),
      );

      return parts.every((part) => haystack.includes(part));
    });
  }, [equipmentData, equipmentQuery]);

  const dashboardDateRangeValues = useMemo(() => enumerateDateRange(dashboardDateFrom, dashboardDateTo), [dashboardDateFrom, dashboardDateTo]);
  const dashboardSummary = useMemo(
    () =>
      buildDashboardSummary({
        entries: dashboardEntries,
        servicesData,
        contracts: contractOptions,
        dateRangeValues: dashboardDateRangeValues,
        selectedContract: dashboardContract,
      }),
    [contractOptions, dashboardContract, dashboardDateRangeValues, dashboardEntries, servicesData],
  );

  function getDraft(serviceId: number): ServiceDraft {
    return (
      serviceDrafts[serviceId] ?? {
        driverId: "",
        driverShiftStatus: "en_turno",
        equipmentCode: "",
      }
    );
  }

  function updateDraft(serviceId: number, patch: Partial<ServiceDraft>) {
    setServiceDrafts((current) => ({
      ...current,
      [serviceId]: {
        ...getDraft(serviceId),
        ...current[serviceId],
        ...patch,
      },
    }));
  }

  function getDriverById(driverId: string): Driver | null {
    return driversData.find((employee) => employee.id === driverId) ?? null;
  }

  function getEquipmentByCode(code: string): Equipment | null {
    return equipmentData.find((item) => item.code === code) ?? null;
  }

  useEffect(() => {
    const client = supabase;
    if (!session || !client) return;

    let active = true;

    async function fetchAllActiveEmployees() {
      if (!client) return [];
      return fetchAllPagedRows({
        pageSize: EMPLOYEES_PAGE_SIZE,
        buildQuery: (from, to) =>
          client
            .from("employees")
            .select("buk_employee_id, full_name, document_number, document_type, area_name, area_code, is_active, status, updated_at")
            .eq("is_active", true)
            .order("full_name", { ascending: true })
            .range(from, to),
      });
    }

    async function loadSessionData() {
      if (!client || !session) return;
      try {
        const [servicesResponse, contractsResponse, employeeRows, equipmentResponse] = await Promise.all([
          client
            .from("base_services")
            .select(
              `
                external_key,
                operational_name,
                company_name,
                service_type,
                contractual_name,
                contractual_category,
                schedule_label,
                contracts:contract_id (code)
              `,
            )
            .order("external_key", { ascending: true }),
          client
            .from("user_contracts")
            .select(
              `
                contracts:contract_id (code, display_name)
              `,
            )
            .eq("user_id", session.user.id),
          fetchAllActiveEmployees(),
          client
            .from("equipment")
            .select("equipment_code, plate, equipment_type, current_client, brand, model, year, is_active, updated_at")
            .eq("is_active", true)
            .order("equipment_code", { ascending: true }),
        ]);

        if (!active) return;

        const { data: rows, error: servicesError } = servicesResponse;
        const { data: contractRows } = contractsResponse;
        const { data: equipmentRows, error: equipmentError } = equipmentResponse;

        if (servicesError) {
          return;
        }

        const normalizedRemoteData: OperationsServiceRecord[] = (rows ?? []).map((row: any) => ({
          id: Number(row.external_key),
          service: row.operational_name,
          company: row.company_name,
          type: row.service_type,
          contractName: row.contractual_name,
          category: row.contractual_category,
          contract: row.contracts?.code ?? "",
          schedule: row.schedule_label,
          normalizedSchedule: normalizeText(row.schedule_label),
        }));

        if (normalizedRemoteData.length > 0) {
          setServicesData(normalizedRemoteData);
        }

        setUserContracts(
          (contractRows ?? [])
            .map((row: any) => row.contracts)
            .filter(Boolean)
            .map((contract: any) => contract.display_name || contract.code),
        );

        if ((employeeRows ?? []).length > 0) {
          setDriversData(buildDriverDirectory(employeeRows));
        }

        if (!equipmentError && (equipmentRows ?? []).length > 0) {
          setEquipmentData(buildEquipmentDirectory(equipmentRows));
        }
      } catch {
        if (active) {
          setDriversData(SAMPLE_DRIVERS);
          setEquipmentData(SAMPLE_EQUIPMENT);
        }
      }
    }

    loadSessionData();

    return () => {
      active = false;
    };
  }, [session]);

  useEffect(() => {
    const client = supabase;
    if (!session || !client) return;

    let active = true;

    async function fetchDashboardEntries() {
      if (!client) return;
      if (!dashboardDateFrom || !dashboardDateTo || dashboardDateFrom > dashboardDateTo) {
        if (!active) return;
        setDashboardEntries([]);
        setDashboardError("Define un rango de fechas válido para cargar el dashboard.");
        return;
      }

      setDashboardLoading(true);
      setDashboardError("");

      try {
        const rows = await fetchAllPagedRows({
          pageSize: DASHBOARD_PAGE_SIZE,
          buildQuery: (from, to) => {
            let query = client
              .from("service_entries")
              .select(DASHBOARD_ENTRY_SELECT)
              .gte("service_date", dashboardDateFrom)
              .lte("service_date", dashboardDateTo)
              .order("service_date", { ascending: false })
              .range(from, to);

            if (dashboardContract) {
              query = query.eq("contract_code", dashboardContract);
            }

            return query;
          },
        });

        if (!active) return;
        setDashboardEntries(rows);
      } catch {
        if (!active) return;
        setDashboardEntries([]);
        setDashboardError("No fue posible cargar los indicadores del dashboard.");
      } finally {
        if (active) {
          setDashboardLoading(false);
        }
      }
    }

    fetchDashboardEntries();

    return () => {
      active = false;
    };
  }, [dashboardContract, dashboardDateFrom, dashboardDateTo, session, submitState.success]);

  useEffect(() => {
    setServiceDrafts({});
    setExpandedServiceId(null);
    setDriverQuery("");
    setOpenDriverServiceId(null);
    setEquipmentQuery("");
    setOpenEquipmentServiceId(null);
    setSubmitState({
      loading: false,
      error: "",
      success: "",
      fieldErrors: {},
      fieldErrorsByService: {},
    });
  }, [selectedContract, selectedShift, selectedDateValue]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (!target.closest(".driver-picker")) {
        setOpenDriverServiceId(null);
        setDriverQuery("");
        setOpenEquipmentServiceId(null);
        setEquipmentQuery("");
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handlePlanSubmit() {
    const globalFieldErrors: Record<string, string> = {};

    if (!selectedContract) globalFieldErrors.contractCode = "Selecciona un contrato válido.";
    if (!selectedShift) globalFieldErrors.shift = "Selecciona un turno válido.";
    if (!selectedDateValue) globalFieldErrors.serviceDate = "Selecciona una fecha válida.";

    if (Object.keys(globalFieldErrors).length > 0) {
      setSubmitState({
        loading: false,
        error: "Corrige los campos marcados antes de enviar.",
        success: "",
        fieldErrors: globalFieldErrors,
        fieldErrorsByService: {},
      });
      return;
    }

    const fieldErrorsByService: Record<number, Record<string, string>> = {};
    const entriesToSubmit: Array<{ serviceId: number; payload: any }> = [];

    for (const service of eligibleServices) {
      const draft = getDraft(service.id);
      const selectedDriver = getDriverById(draft.driverId);
      const touched = Boolean(draft.driverId || draft.equipmentCode || draft.driverShiftStatus !== "en_turno");
      const completed = Boolean(draft.driverId && draft.equipmentCode);

      if (!touched) {
        continue;
      }

      const validation = validateServiceEntryPayload({
        contractCode: selectedContract,
        shift: selectedShift,
        serviceDate: selectedDateValue,
        serviceExternalKey: service.id,
        driverName: selectedDriver?.fullName ?? "",
        driverDocument: selectedDriver?.documentNumber ?? "",
        driverArea: selectedDriver?.areaName || selectedDriver?.areaCode || "",
        driverShiftStatus: draft.driverShiftStatus,
        equipmentCode: draft.equipmentCode,
      });

      if (!validation.isValid || !completed || !validation.cleaned) {
        fieldErrorsByService[service.id] = validation.errors;
        if (!completed) {
          fieldErrorsByService[service.id] = {
            ...fieldErrorsByService[service.id],
            ...(draft.driverId ? {} : { driverName: "Selecciona un conductor válido." }),
            ...(draft.equipmentCode ? {} : { equipmentCode: "Selecciona un equipo válido." }),
          };
        }
        continue;
      }

      entriesToSubmit.push({
        serviceId: service.id,
        payload: validation.cleaned,
      });
    }

    if (Object.keys(fieldErrorsByService).length > 0) {
      const [firstErrorServiceId] = Object.keys(fieldErrorsByService);
      setExpandedServiceId(Number(firstErrorServiceId));
      setSubmitState({
        loading: false,
        error: "Corrige los módulos con información incompleta antes de enviar.",
        success: "",
        fieldErrors: {},
        fieldErrorsByService,
      });
      return;
    }

    if (entriesToSubmit.length === 0) {
      setSubmitState({
        loading: false,
        error: "No hay servicios completos para enviar.",
        success: "",
        fieldErrors: {},
        fieldErrorsByService: {},
      });
      return;
    }

    setSubmitState({
      loading: true,
      error: "",
      success: "",
      fieldErrors: {},
      fieldErrorsByService: {},
    });

    const apiFieldErrorsByService: Record<number, Record<string, string>> = {};

    for (const entry of entriesToSubmit) {
      const response = await submitServiceEntry(entry.payload, user?.id || "");
      
      if (!response.ok) {
        apiFieldErrorsByService[entry.serviceId] = response.fieldErrors || { serviceExternalKey: response.error || "No fue posible guardar la planificación." };
      }
    }

    if (Object.keys(apiFieldErrorsByService).length > 0) {
      const [firstErrorServiceId] = Object.keys(apiFieldErrorsByService);
      setExpandedServiceId(Number(firstErrorServiceId));
      setSubmitState({
        loading: false,
        error: "No fue posible guardar uno o más servicios.",
        success: "",
        fieldErrors: {},
        fieldErrorsByService: apiFieldErrorsByService,
      });
      return;
    }

    setSubmitState({
      loading: false,
      error: "",
      success: `${entriesToSubmit.length} servicio(s) guardados correctamente.`,
      fieldErrors: {},
      fieldErrorsByService: {},
    });
  }

  async function handlePasswordUpdate(event: React.FormEvent) {
    event.preventDefault();
    setPasswordMessage("");

    if (!newPassword || !confirmPassword) {
      setPasswordMessage("Completa ambos campos de contraseña.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage("Las contraseñas no coinciden.");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordMessage("La nueva contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (!supabase) {
      setPasswordMessage("Supabase no está configurado.");
      return;
    }

    setPasswordLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      setPasswordMessage("No fue posible actualizar la contraseña.");
    } else {
      setPasswordMessage("Contraseña actualizada correctamente.");
      setNewPassword("");
      setConfirmPassword("");
    }
    setPasswordLoading(false);
  }

  async function handleExportSearch() {
    if (!exportDateFrom || !exportDateTo || exportDateFrom > exportDateTo) {
      setExportRows([]);
      setExportSearched(true);
      setExportError("Define un rango de fechas válido para consultar la información.");
      return;
    }

    const client = supabase;
    if (!client) {
      setExportError("Supabase no está configurado.");
      return;
    }

    setExportLoading(true);
    setExportError("");
    setExportSearched(true);

    try {
      const rows = await fetchAllPagedRows({
        pageSize: EXPORT_PAGE_SIZE,
        buildQuery: (from, to) => {
          let query = client
            .from("service_entries")
            .select(EXPORT_ENTRY_SELECT)
            .gte("service_date", exportDateFrom)
            .lte("service_date", exportDateTo)
            .order("service_date", { ascending: true })
            .order("shift", { ascending: true })
            .range(from, to);

          if (exportContract) {
            query = query.eq("contract_code", exportContract);
          }

          return query;
        },
      });

      setExportRows(rows);
    } catch {
      setExportRows([]);
      setExportError("No fue posible consultar la información histórica.");
    } finally {
      setExportLoading(false);
    }
  }

  async function handleExportExcel() {
    if (exportRows.length === 0) return;

    const { utils, writeFile } = await import("xlsx");
    const workbook = utils.book_new();
    const worksheetRows = exportRows.map((row) => ({
      Fecha: row.service_date,
      Turno: row.shift ? row.shift.toUpperCase() : "",
      Contrato: row.contract_code ?? "",
      Servicio: row.service_operational_name ?? "",
      "Nombre contractual": row.service_contractual_name ?? "",
      "Categoria contractual": row.service_category ?? "",
      "Empresa usuaria": row.service_company ?? "",
      Conductor: row.driver_name ?? "",
      "RUT / Documento": row.driver_document ?? "",
      Area: row.driver_area ?? "",
      "Estado de turno": row.driver_shift_status === "fuera_de_turno" ? "Fuera de Turno" : "En Turno",
      Equipo: row.equipment_code ?? "",
      Patente: row.equipment_plate ?? "",
      Tipo: row.equipment_type ?? "",
      "Cliente actual": row.equipment_client ?? "",
      "Fecha de registro": row.created_at ? new Date(row.created_at).toLocaleString("es-CL") : "",
    }));

    const worksheet = utils.json_to_sheet(worksheetRows);
    worksheet["!cols"] = [
      { wch: 12 },
      { wch: 8 },
      { wch: 24 },
      { wch: 28 },
      { wch: 32 },
      { wch: 26 },
      { wch: 22 },
      { wch: 30 },
      { wch: 16 },
      { wch: 28 },
      { wch: 18 },
      { wch: 12 },
      { wch: 12 },
      { wch: 18 },
      { wch: 22 },
      { wch: 20 },
    ];
    utils.book_append_sheet(workbook, worksheet, "Planificacion");

    const filename = `planificacion-${exportContract ? normalizeText(exportContract).replace(/\s+/g, "-") : "todos"}-${exportDateFrom}-${exportDateTo}.xlsx`;
    writeFile(workbook, filename);
  }

  const categoriesCount = new Set(eligibleServices.map((item) => item.category)).size;
  const allServicesComplete =
    eligibleServices.length > 0 &&
    eligibleServices.every((service) => {
      const draft = getDraft(service.id);
      return Boolean(getDriverById(draft.driverId) && getEquipmentByCode(draft.equipmentCode));
    });

  return (
    <div className="operaciones-module-shell operations-theme">
      <main className="content operaciones-content">
        {activePage === "resumen" && (
          <OperationsSummary
            dashboardContract={dashboardContract}
            setDashboardContract={setDashboardContract}
            contractOptions={contractOptions}
            dashboardDateFrom={dashboardDateFrom}
            setDashboardDateFrom={setDashboardDateFrom}
            dashboardDateTo={dashboardDateTo}
            setDashboardDateTo={setDashboardDateTo}
            dashboardSummary={dashboardSummary}
            dashboardLoading={dashboardLoading}
            dashboardError={dashboardError}
          />
        )}

        {activePage === "registros_base" && (
          <OperationsBaseRegister
            selectedDateValue={selectedDateValue}
            setSelectedDateValue={setSelectedDateValue}
            selectedShift={selectedShift}
            setSelectedShift={setSelectedShift}
            selectedContract={selectedContract}
            setSelectedContract={setSelectedContract}
            contractOptions={contractOptions}
            eligibleServices={eligibleServices}
            categoriesCount={categoriesCount}
            submitState={submitState}
            allServicesComplete={allServicesComplete}
            handlePlanSubmit={handlePlanSubmit}
            isPasswordCardOpen={isPasswordCardOpen}
            setIsPasswordCardOpen={setIsPasswordCardOpen}
            newPassword={newPassword}
            setNewPassword={setNewPassword}
            confirmPassword={confirmPassword}
            setConfirmPassword={setConfirmPassword}
            passwordMessage={passwordMessage}
            setPasswordMessage={setPasswordMessage}
            passwordLoading={passwordLoading}
            handlePasswordUpdate={handlePasswordUpdate}
            getDraft={getDraft}
            updateDraft={updateDraft}
            getDriverById={getDriverById}
            getEquipmentByCode={getEquipmentByCode}
            expandedServiceId={expandedServiceId}
            setExpandedServiceId={setExpandedServiceId}
            openDriverServiceId={openDriverServiceId}
            setOpenDriverServiceId={setOpenDriverServiceId}
            openEquipmentServiceId={openEquipmentServiceId}
            setOpenEquipmentServiceId={setOpenEquipmentServiceId}
            driverQuery={driverQuery}
            setDriverQuery={setDriverQuery}
            equipmentQuery={equipmentQuery}
            setEquipmentQuery={setEquipmentQuery}
            filteredDrivers={filteredDrivers}
            filteredEquipment={filteredEquipment}
          />
        )}

        {activePage === "registros_especiales" && (
          <OperationsSpecialRegister />
        )}

        {activePage === "exportador" && (
          <OperationsExport
            exportContract={exportContract}
            setExportContract={setExportContract}
            contractOptions={contractOptions}
            exportDateFrom={exportDateFrom}
            setExportDateFrom={setExportDateFrom}
            exportDateTo={exportDateTo}
            setExportDateTo={setExportDateTo}
            exportRows={exportRows}
            exportLoading={exportLoading}
            exportError={exportError}
            exportSearched={exportSearched}
            handleExportSearch={handleExportSearch}
            handleExportExcel={handleExportExcel}
          />
        )}
      </main>
    </div>
  );
}
