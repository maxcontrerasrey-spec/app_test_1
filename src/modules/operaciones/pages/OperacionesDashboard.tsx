import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../../../shared/lib/supabase";
import { validateServiceEntryPayload } from "../lib/service-entry";
import {
  buildDashboardSummary,
  buildEquipmentDirectory,
  enumerateDateRange,
  fetchAllPagedRows,
  matchesSchedule,
  normalizeText
} from "../lib/transformers";
import { submitServiceEntriesBatch } from "../services/operacionesApi";
import { SERVICE_DATA } from "../data/services-data";
import { useAuth } from "../../auth/context/AuthContext";
import {
  parseDateValue,
  toTodayDateValue,
} from "../../../shared/lib/date";
import type {
  BaseServiceQueryRow,
  DashboardEntryRow,
  DashboardSummary,
  Driver,
  Equipment,
  EquipmentDirectoryRow,
  ExportEntryRow,
  OperationsServiceRecord,
  PendingServiceSubmission,
  ServiceDraft,
  UserContractQueryRow
} from "../types";

import { OperationsSummary } from "../components/OperationsSummary";
import { OperationsBaseRegister } from "../components/OperationsBaseRegister";
import { OperationsExport } from "../components/OperationsExport";
import { OperationsSpecialRegister } from "../components/OperationsSpecialRegister";
import "../styles/operaciones.css";

const PILOT_CONTRACTS = ["CODELCO DRT", "CODELCO DMH"];
const EXPORT_PAGE_SIZE = 1000;
const DASHBOARD_PAGE_SIZE = 1000;
const DASHBOARD_ENTRY_SELECT = "contract_code, service_date, shift, driver_name, driver_shift_status, service_operational_name";
const EXPORT_ENTRY_SELECT =
  "service_date, shift, contract_code, service_operational_name, service_contractual_name, service_category, service_company, service_execution_status, service_execution_note, driver_name, driver_document, driver_area, driver_shift_status, equipment_code, equipment_plate, equipment_type, equipment_client, created_at";

const LOCAL_NORMALIZED_DATA: OperationsServiceRecord[] = SERVICE_DATA.map((item) => ({
  ...item,
  normalizedSchedule: normalizeText(item.schedule),
}));

function normalizeOperationsContractLabel(value: string | null | undefined) {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "";
  return trimmed.replace(/^SERVICIO\s+/i, "");
}

function sortOperationsContracts(contracts: string[]) {
  const unique = [...new Set(contracts.map(normalizeOperationsContractLabel).filter(Boolean))];
  return unique.sort((left, right) => {
    const leftIndex = PILOT_CONTRACTS.indexOf(left);
    const rightIndex = PILOT_CONTRACTS.indexOf(right);

    if (leftIndex >= 0 || rightIndex >= 0) {
      if (leftIndex === -1) return 1;
      if (rightIndex === -1) return -1;
      return leftIndex - rightIndex;
    }

    return left.localeCompare(right, "es");
  });
}

export function OperacionesDashboard() {
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => toTodayDateValue(), []);
  const { appRoles, isSuperAdmin, session, user } = useAuth();
  const { view } = useParams();
  const activePage = view?.replace("-", "_") || "resumen";
  const canManageOperations =
    isSuperAdmin ||
    appRoles.includes("admin") ||
    appRoles.includes("operaciones_l_1") ||
    appRoles.includes("operaciones_l_2");

  const [selectedContract, setSelectedContract] = useState("");
  const [selectedShift, setSelectedShift] = useState("");
  const [selectedDateValue, setSelectedDateValue] = useState(todayStr);

  const [dashboardContract, setDashboardContract] = useState("");
  const [dashboardDateFrom, setDashboardDateFrom] = useState(todayStr);
  const [dashboardDateTo, setDashboardDateTo] = useState(todayStr);
  const [dashboardEntries, setDashboardEntries] = useState<DashboardEntryRow[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState("");

  const [exportContract, setExportContract] = useState("");
  const [exportDateFrom, setExportDateFrom] = useState(todayStr);
  const [exportDateTo, setExportDateTo] = useState(todayStr);
  const [exportRows, setExportRows] = useState<ExportEntryRow[]>([]);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState("");
  const [exportSearched, setExportSearched] = useState(false);

  const [servicesData, setServicesData] = useState<OperationsServiceRecord[]>(LOCAL_NORMALIZED_DATA);
  const [serviceDrafts, setServiceDrafts] = useState<Record<number, ServiceDraft>>({});
  const [expandedServiceId, setExpandedServiceId] = useState<number | null>(null);

  const [userContracts, setUserContracts] = useState<string[]>([]);

  const [driverDirectory, setDriverDirectory] = useState<Record<string, Driver>>({});
  const [equipmentData, setEquipmentData] = useState<Equipment[]>([]);
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
    return sortOperationsContracts(servicesData.map((item) => item.contract));
  }, [servicesData]);
  const contractOptions = userContracts.length > 0 ? sortOperationsContracts(userContracts) : availableContracts;

  const eligibleServices = useMemo(() => {
    if (!selectedContract || !selectedShift || !selectedDate) return [];
    return servicesData.filter(
      (item) => item.contract === selectedContract && matchesSchedule(item.normalizedSchedule, selectedDate),
    );
  }, [selectedContract, selectedShift, selectedDate, servicesData]);

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
        equipmentCode: "",
        serviceExecutionStatus: "planned",
        serviceExecutionNote: "",
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
    return driverDirectory[driverId] ?? null;
  }

  function rememberDriver(driver: Driver) {
    setDriverDirectory((current) => ({
      ...current,
      [driver.id]: driver,
    }));
  }

  function getEquipmentByCode(code: string): Equipment | null {
    return equipmentData.find((item) => item.code === code) ?? null;
  }

  useEffect(() => {
    const client = supabase;
    if (!session || !client) return;

    let active = true;

    async function loadSessionData() {
      if (!client || !session) return;
      try {
        const [servicesResponse, contractsResponse, contractsCatalogResponse, equipmentResponse] = await Promise.all([
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
                contract_id,
                contracts:contract_id (code, contract_name)
              `,
            )
            .order("external_key", { ascending: true }),
          client
            .from("user_contracts")
            .select(
              `
                contracts:contract_id (code, contract_name)
              `,
            )
            .eq("user_id", session.user.id),
          client
            .from("contracts")
            .select("id, code, contract_name")
            .eq("is_active", true),
          client
            .from("equipment")
            .select("equipment_code, plate, equipment_type, current_client, brand, model, year, is_active, updated_at")
            .eq("is_active", true)
            .order("equipment_code", { ascending: true }),
        ]);

        if (!active) return;

        const { data: rows, error: servicesError } = servicesResponse;
        const { data: contractRows } = contractsResponse;
        const { data: contractsCatalogRows } = contractsCatalogResponse;
        const { data: equipmentRows, error: equipmentError } = equipmentResponse;

        if (servicesError) {
          return;
        }

        const contractCatalogById = new Map(
          ((contractsCatalogRows ?? []) as Array<{ id: number | string; code: string | null; contract_name: string | null }>)
            .map((contract) => [
              Number(contract.id),
              normalizeOperationsContractLabel(contract.contract_name || contract.code || ""),
            ] as const)
        );

        const normalizedRemoteData: OperationsServiceRecord[] = ((rows ?? []) as BaseServiceQueryRow[]).map((row) => {
          const resolvedContract = normalizeOperationsContractLabel(
            row.contracts?.[0]?.contract_name ||
              row.contracts?.[0]?.code ||
              contractCatalogById.get(Number(row.contract_id ?? 0)) ||
              ""
          );

          return {
            id: Number(row.external_key),
            service: row.operational_name,
            company: row.company_name,
            type: row.service_type,
            contractName: row.contractual_name,
            category: row.contractual_category,
            contract: resolvedContract,
            schedule: row.schedule_label,
            normalizedSchedule: normalizeText(row.schedule_label),
          };
        });

        if (normalizedRemoteData.length > 0) {
          setServicesData(normalizedRemoteData);
        }

        setUserContracts(
          sortOperationsContracts(
            ((contractRows ?? []) as UserContractQueryRow[])
              .flatMap((row) => row.contracts ?? [])
              .map((contract) => contract.contract_name || contract.code || "")
              .filter(Boolean)
          ),
        );

        if (!equipmentError && (equipmentRows ?? []).length > 0) {
          setEquipmentData(buildEquipmentDirectory(equipmentRows as EquipmentDirectoryRow[]));
        }
      } catch {
        if (active) {
          setDriverDirectory({});
          setEquipmentData([]);
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
        const rows = await fetchAllPagedRows<DashboardEntryRow>({
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
    setDriverDirectory({});
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
    const entriesToSubmit: PendingServiceSubmission[] = [];

    for (const service of eligibleServices) {
      const draft = getDraft(service.id);
      const selectedDriver = getDriverById(draft.driverId);
      const isMarkedNotPerformed = draft.serviceExecutionStatus === "not_performed";
      const touched = isMarkedNotPerformed || Boolean(draft.driverId || draft.equipmentCode);
      const completed = isMarkedNotPerformed || Boolean(draft.driverId && draft.equipmentCode);

      if (!touched) {
        continue;
      }

      const validation = validateServiceEntryPayload({
        contractCode: selectedContract,
        shift: selectedShift,
        serviceDate: selectedDateValue,
        serviceExternalKey: service.id,
        serviceExecutionStatus: draft.serviceExecutionStatus,
        serviceExecutionNote: draft.serviceExecutionNote,
        driverName: selectedDriver?.fullName ?? "",
        driverDocument: selectedDriver?.documentNumber ?? "",
        driverArea: selectedDriver?.areaName || selectedDriver?.areaCode || "",
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

    const response = await submitServiceEntriesBatch(entriesToSubmit, user?.id || "");
    const apiFieldErrorsByService = response.fieldErrorsByService || {};

    if (!response.ok || Object.keys(apiFieldErrorsByService).length > 0) {
      const [firstErrorServiceId] = Object.keys(apiFieldErrorsByService);
      if (firstErrorServiceId) {
        setExpandedServiceId(Number(firstErrorServiceId));
      }
      setSubmitState({
        loading: false,
        error: response.error || "No fue posible guardar uno o más servicios.",
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
        const rows = await fetchAllPagedRows<ExportEntryRow>({
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

    const { utils, writeFile } = await import("@mylinkpi/xlsx");
    const workbook = utils.book_new();
    const worksheetRows = exportRows.map((row) => ({
      Fecha: row.service_date,
      Turno: row.shift ? row.shift.toUpperCase() : "",
      Contrato: row.contract_code ?? "",
      Servicio: row.service_operational_name ?? "",
      "Nombre contractual": row.service_contractual_name ?? "",
      "Categoria contractual": row.service_category ?? "",
      "Empresa usuaria": row.service_company ?? "",
      "Estado servicio": row.service_execution_status === "not_performed" ? "Servicio no realizado" : "Planificado",
      Observacion: row.service_execution_note ?? "",
      Conductor: row.driver_name ?? "",
      "RUT / Documento": row.driver_document ?? "",
      Area: row.driver_area ?? "",
      "Estado de turno":
        row.driver_shift_status === "fuera_de_turno"
          ? "Fuera de Turno"
          : row.driver_shift_status === "en_turno"
            ? "En Turno"
            : "",
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
      { wch: 18 },
      { wch: 24 },
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
      if (draft.serviceExecutionStatus === "not_performed") {
        return true;
      }

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
            canManageOperations={canManageOperations}
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

            getDraft={getDraft}
            updateDraft={updateDraft}
            getDriverById={getDriverById}
            rememberDriver={rememberDriver}
            getEquipmentByCode={getEquipmentByCode}
            expandedServiceId={expandedServiceId}
            setExpandedServiceId={setExpandedServiceId}
            openEquipmentServiceId={openEquipmentServiceId}
            setOpenEquipmentServiceId={setOpenEquipmentServiceId}
            equipmentQuery={equipmentQuery}
            setEquipmentQuery={setEquipmentQuery}
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
