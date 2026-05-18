// @ts-nocheck
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";

import { supabase } from "../../../shared/lib/supabase";
import { validateServiceEntryPayload } from "../lib/service-entry";
import { submitServiceEntry } from "../services/operacionesApi";
import { SERVICE_DATA } from "../data/services-data";
import "../styles/operaciones.css";

const PILOT_CONTRACTS = ["CODELCO DRT", "SERVICIO CODELCO DMH"];
const WEEKDAY_NAMES = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
const MONTH_LABELS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];
const SAMPLE_DRIVERS = ["Carlos Rojas", "Juan Araya", "Luis Muñoz", "Pedro Cortés", "Marco Silva", "Héctor Díaz"].map((fullName, index) => ({
  id: `sample-${index + 1}`,
  fullName,
  documentNumber: "",
  areaName: "",
  areaCode: "",
  isActive: true,
}));
const SAMPLE_EQUIPMENT = ["BUS-042", "BUS-115", "MB-203", "TX-018", "TX-026", "CRY-015"].map((equipmentCode) => ({
  code: equipmentCode,
  plate: "",
  type: "",
}));
const LOGIN_BULLETS = [
  {
    text: "Planificación y control de servicios operacionales por contrato.",
    icon: "/assets/login-planificacion.png",
    alt: "Planificación operativa",
  },
  {
    text: "Control y gestión de conductores y turnos.",
    icon: "/assets/login-control.png",
    alt: "Gestión de conductores y turnos",
  },
  {
    text: "Control y gestión de base de datos histórica de servicios.",
    icon: "/assets/login-registro.png",
    alt: "Base histórica de servicios",
  },
];
const NAV_ITEMS = [
  { id: "inicio", label: "Inicio", icon: "/assets/nav-home.png" },
  { id: "registros_base", label: "Registro de servicios base", icon: "/assets/nav-base.png" },
  { id: "registros_especiales", label: "Registro de servicios especiales", icon: "/assets/nav-specials.png" },
  { id: "exportador", label: "Exportador de Información", icon: "/assets/nav-export.png" },
];
const EMPLOYEES_PAGE_SIZE = 1000;
const EXPORT_PAGE_SIZE = 1000;
const DASHBOARD_PAGE_SIZE = 1000;
const DASHBOARD_ENTRY_SELECT = "contract_code, service_date, shift, driver_name, driver_shift_status, service_operational_name";
const EXPORT_ENTRY_SELECT =
  "service_date, shift, contract_code, service_operational_name, service_contractual_name, service_category, service_company, driver_name, driver_document, driver_area, driver_shift_status, equipment_code, equipment_plate, equipment_type, equipment_client, created_at";

function formatShiftLabel(shift) {
  return shift ? shift.toUpperCase() : "";
}

function formatTurnStatusLabel(value) {
  return value === "fuera_de_turno" ? "Fuera de Turno" : "En Turno";
}

function normalizeText(value) {
  return (value ?? "")
    .toString()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function formatStorageDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getDateFromStorage(value) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
}

function formatDisplayDate(date) {
  return date.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatLongDate(date) {
  if (!date) return "sin fecha";
  return date.toLocaleDateString("es-CL", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function enumerateDateRange(startValue, endValue) {
  if (!startValue || !endValue || startValue > endValue) return [];

  const startDate = getDateFromStorage(startValue);
  const endDate = getDateFromStorage(endValue);

  if (!startDate || !endDate || startDate > endDate) return [];

  const dates = [];
  const cursor = new Date(startDate);

  while (cursor <= endDate && dates.length < 400) {
    dates.push(formatStorageDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

async function fetchAllPagedRows({ pageSize, buildQuery }) {
  const rows = [];
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

function formatDisplayName(email) {
  if (!email) return "Usuario";
  const [namePart] = email.split("@");
  return namePart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

function matchesSchedule(normalizedSchedule, date) {
  if (!date || !normalizedSchedule) return true;
  const weekday = date.getDay();
  if (normalizedSchedule === "lunes a domingo") return true;
  if (normalizedSchedule === "lunes a jueves") return weekday >= 1 && weekday <= 4;
  if (normalizedSchedule === "lunes a viernes") return weekday >= 1 && weekday <= 5;
  return normalizedSchedule.includes(WEEKDAY_NAMES[weekday]);
}

function buildDriverDirectory(rows) {
  const grouped = new Map();

  for (const employee of rows ?? []) {
    if (!employee?.full_name) continue;

    const key = `${employee.document_number || "sin-documento"}::${normalizeText(employee.full_name)}`;
    const current = grouped.get(key);
    const candidate = {
      id: employee.buk_employee_id,
      fullName: employee.full_name,
      documentNumber: employee.document_number ?? "",
      documentType: employee.document_type ?? "",
      areaName: employee.area_name ?? "",
      areaCode: employee.area_code ?? "",
      isActive: employee.is_active !== false,
      status: employee.status ?? "",
      updatedAt: employee.updated_at ?? "",
    };

    if (!current) {
      grouped.set(key, candidate);
      continue;
    }

    const currentScore =
      (current.isActive ? 100 : 0) +
      (current.areaName ? 10 : 0) +
      (current.documentNumber ? 5 : 0) +
      (current.updatedAt ? new Date(current.updatedAt).getTime() / 10 ** 12 : 0);
    const candidateScore =
      (candidate.isActive ? 100 : 0) +
      (candidate.areaName ? 10 : 0) +
      (candidate.documentNumber ? 5 : 0) +
      (candidate.updatedAt ? new Date(candidate.updatedAt).getTime() / 10 ** 12 : 0);

    if (candidateScore > currentScore) {
      grouped.set(key, candidate);
    }
  }

  return [...grouped.values()].sort((left, right) => left.fullName.localeCompare(right.fullName, "es"));
}

function buildEquipmentDirectory(rows) {
  const grouped = new Map();

  for (const row of rows ?? []) {
    const code = (row?.equipment_code ?? "").toString().trim();
    if (!code) continue;

    const candidate = {
      code,
      plate: (row?.plate ?? "").toString().trim(),
      type: (row?.equipment_type ?? "").toString().trim(),
      currentClient: (row?.current_client ?? "").toString().trim(),
      brand: (row?.brand ?? "").toString().trim(),
      model: (row?.model ?? "").toString().trim(),
      year: row?.year ? String(row.year).trim() : "",
      isActive: row?.is_active !== false,
      updatedAt: row?.updated_at ?? "",
    };

    const current = grouped.get(code);
    if (!current) {
      grouped.set(code, candidate);
      continue;
    }

    const currentScore =
      (current.isActive ? 100 : 0) +
      (current.plate ? 10 : 0) +
      (current.type ? 5 : 0) +
      (current.updatedAt ? new Date(current.updatedAt).getTime() / 10 ** 12 : 0);
    const candidateScore =
      (candidate.isActive ? 100 : 0) +
      (candidate.plate ? 10 : 0) +
      (candidate.type ? 5 : 0) +
      (candidate.updatedAt ? new Date(candidate.updatedAt).getTime() / 10 ** 12 : 0);

    if (candidateScore > currentScore) {
      grouped.set(code, candidate);
    }
  }

  return [...grouped.values()].sort((left, right) => left.code.localeCompare(right.code, "es"));
}

function buildDashboardSummary({ entries, servicesData, contracts, dateRangeValues, selectedContract }) {
  const contractScope = (selectedContract ? [selectedContract] : contracts).filter(Boolean);

  const byContract = contractScope.map((contractCode) => {
    const contractEntries = entries.filter((entry) => entry.contract_code === contractCode);
    const expectedServices = dateRangeValues.reduce((total, dateValue) => {
      const date = getDateFromStorage(dateValue);
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
    (summary, contractSummary) => {
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

const LOCAL_NORMALIZED_DATA = SERVICE_DATA.map((item) => ({
  ...item,
  normalizedSchedule: normalizeText(item.schedule),
}));

function LoginScreen({ email, password, onEmailChange, onPasswordChange, onSubmit, authLoading, authError }) {
  return (
    <main className="login-shell">
      <section className="login-panel">
        <div className="login-copy">
          <div className="login-heading">
            <div className="login-brand">
              <img src="/assets/app-logo.png" alt="JM" />
            </div>
            <h1>Plataforma de Control</h1>
          </div>
          <div className="login-bullets">
            {LOGIN_BULLETS.map((bullet, index) => (
              <article key={bullet.text} className="login-bullet">
                <span className="login-bullet__icon">
                  <img
                    src={bullet.icon}
                    alt={bullet.alt}
                    className={index === 0 ? "login-bullet__image login-bullet__image--planificacion" : "login-bullet__image"}
                  />
                </span>
                <p>{bullet.text}</p>
              </article>
            ))}
          </div>
        </div>
        <p className="login-footnote">
          Somos especialistas en faenas mineras. Conectamos planificación, control y seguimiento en una sola plataforma.
        </p>
      </section>

      <section className="login-card-wrap">
        <div className="login-card">
          <h2>Iniciar sesión</h2>
          <form className="login-form" onSubmit={onSubmit}>
            <label>
              <span>Correo corporativo</span>
              <input type="email" value={email} onChange={(event) => onEmailChange(event.target.value)} placeholder="nombre.apellido@busesjm.cl" required />
            </label>
            <label>
              <span>Contraseña</span>
              <input type="password" value={password} onChange={(event) => onPasswordChange(event.target.value)} placeholder="••••••••" required />
            </label>
            {authError ? <p className="login-error">{authError}</p> : null}
            <button type="submit" className="primary-button login-submit" disabled={authLoading}>
              {authLoading ? "Ingresando..." : "Continuar"}
            </button>
            <button type="button" className="link-button" onClick={() => onSubmit("reset")} disabled={authLoading}>
              Olvidé mi contraseña
            </button>
          </form>
          <p className="login-note">Conexión segura. Usa tus credenciales de Buses JM.</p>
        </div>
      </section>
    </main>
  );
}

function DatePickerField({ label, value, onChange, today }) {
  const selectedDate = getDateFromStorage(value) ?? today;
  const [isOpen, setIsOpen] = useState(false);
  const [viewYear, setViewYear] = useState(selectedDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(selectedDate.getMonth());
  const pickerRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    const nextDate = getDateFromStorage(value) ?? today;
    setViewYear(nextDate.getFullYear());
    setViewMonth(nextDate.getMonth());
  }, [today, value]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(event.target) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const startOffset = (firstDay.getDay() + 6) % 7;
    const items = [];

    for (let i = 0; i < startOffset; i += 1) {
      items.push({ type: "spacer", key: `spacer-${viewYear}-${viewMonth}-${i}` });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(viewYear, viewMonth, day, 12, 0, 0);
      items.push({
        type: "day",
        key: formatStorageDate(date),
        date,
        day,
        isSelected: formatStorageDate(date) === value,
        isToday: formatStorageDate(date) === formatStorageDate(today),
      });
    }

    return items;
  }, [today, value, viewMonth, viewYear]);

  function handleDateSelection(date) {
    onChange(formatStorageDate(date));
    setViewYear(date.getFullYear());
    setViewMonth(date.getMonth());
    setIsOpen(false);
  }

  return (
    <label className="date-picker-field">
      <span>{label}</span>
      <button
        ref={triggerRef}
        className="input-like-button"
        type="button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        {formatDisplayDate(selectedDate)}
      </button>

      <div ref={pickerRef} className={`date-picker${isOpen ? "" : " is-hidden"}`} role="dialog" aria-label={`Seleccionar ${label.toLowerCase()}`}>
        <div className="date-picker__header">
          <select value={viewMonth} onChange={(event) => setViewMonth(Number(event.target.value))}>
            {MONTH_LABELS.map((month, index) => (
              <option key={month} value={index}>
                {month}
              </option>
            ))}
          </select>
          <select value={viewYear} onChange={(event) => setViewYear(Number(event.target.value))}>
            {Array.from({ length: 7 }, (_, index) => today.getFullYear() - 4 + index).map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>

        <div className="date-picker__weekdays">
          <span>L</span>
          <span>M</span>
          <span>M</span>
          <span>J</span>
          <span>V</span>
          <span>S</span>
          <span>D</span>
        </div>

        <div className="date-picker__grid">
          {calendarDays.map((item) =>
            item.type === "spacer" ? (
              <span key={item.key} className="date-picker__spacer" />
            ) : (
              <button
                key={item.key}
                type="button"
                className={`date-picker__day${item.isSelected ? " is-selected" : ""}${item.isToday ? " is-today" : ""}`}
                onClick={() => handleDateSelection(item.date)}
              >
                {item.day}
              </button>
            ),
          )}
        </div>
      </div>
    </label>
  );
}

export function OperacionesDashboard() {
  const today = useMemo(() => new Date(), []);
  const [session, setSession] = useState(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const { view } = useParams();
  const activePage = view?.replace("-", "_") || "resumen";
  const [selectedContract, setSelectedContract] = useState("");
  const [selectedShift, setSelectedShift] = useState("");
  const [selectedDateValue, setSelectedDateValue] = useState(formatStorageDate(today));
  const [dashboardContract, setDashboardContract] = useState("");
  const [dashboardDateFrom, setDashboardDateFrom] = useState(formatStorageDate(today));
  const [dashboardDateTo, setDashboardDateTo] = useState(formatStorageDate(today));
  const [dashboardEntries, setDashboardEntries] = useState([]);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState("");
  const [exportContract, setExportContract] = useState("");
  const [exportDateFrom, setExportDateFrom] = useState(formatStorageDate(today));
  const [exportDateTo, setExportDateTo] = useState(formatStorageDate(today));
  const [exportRows, setExportRows] = useState([]);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState("");
  const [exportSearched, setExportSearched] = useState(false);
  const [servicesData, setServicesData] = useState(LOCAL_NORMALIZED_DATA);
  const [serviceDrafts, setServiceDrafts] = useState({});
  const [expandedServiceId, setExpandedServiceId] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [userContracts, setUserContracts] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [isPasswordCardOpen, setIsPasswordCardOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [openDriverServiceId, setOpenDriverServiceId] = useState(null);
  const [driversData, setDriversData] = useState(SAMPLE_DRIVERS);
  const [equipmentData, setEquipmentData] = useState(SAMPLE_EQUIPMENT);
  const [driverQuery, setDriverQuery] = useState("");
  const [openEquipmentServiceId, setOpenEquipmentServiceId] = useState(null);
  const [equipmentQuery, setEquipmentQuery] = useState("");
  const [submitState, setSubmitState] = useState({
    loading: false,
    error: "",
    success: "",
    fieldErrors: {},
    fieldErrorsByService: {},
  });

  const selectedDate = getDateFromStorage(selectedDateValue);

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

  function getDraft(serviceId) {
    return (
      serviceDrafts[serviceId] ?? {
        driverId: "",
        driverShiftStatus: "en_turno",
        equipmentCode: "",
      }
    );
  }

  function updateDraft(serviceId, patch) {
    setServiceDrafts((current) => ({
      ...current,
      [serviceId]: {
        ...getDraft(serviceId),
        ...current[serviceId],
        ...patch,
      },
    }));
  }

  function getDriverById(driverId) {
    return driversData.find((employee) => employee.id === driverId) ?? null;
  }

  function getEquipmentByCode(code) {
    return equipmentData.find((item) => item.code === code) ?? null;
  }

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) {
        setAuthError("No pudimos recuperar la sesión actual.");
      }
      setSession(data.session ?? null);
      setSessionReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession ?? null);
      setSessionReady(true);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!session) return;

    let active = true;

    async function fetchAllActiveEmployees() {
      return fetchAllPagedRows({
        pageSize: EMPLOYEES_PAGE_SIZE,
        buildQuery: (from, to) =>
          supabase
            .from("employees")
            .select("buk_employee_id, full_name, document_number, document_type, area_name, area_code, is_active, status, updated_at")
            .eq("is_active", true)
            .order("full_name", { ascending: true })
            .range(from, to),
      });
    }

    async function loadSessionData() {
      try {
        const [servicesResponse, contractsResponse, profileResponse, employeeRows, equipmentResponse] = await Promise.all([
          supabase
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
          supabase
            .from("user_contracts")
            .select(
              `
                contracts:contract_id (code, display_name)
              `,
            )
            .eq("user_id", session.user.id),
          supabase
            .from("profiles")
            .select("full_name, app_role")
            .eq("id", session.user.id)
            .maybeSingle(),
          fetchAllActiveEmployees(),
          supabase
            .from("equipment")
            .select("equipment_code, plate, equipment_type, current_client, brand, model, year, is_active, updated_at")
            .eq("is_active", true)
            .order("equipment_code", { ascending: true }),
        ]);

        if (!active) return;

        const { data: rows, error: servicesError } = servicesResponse;
        const { data: contractRows } = contractsResponse;
        const { data: profileRow } = profileResponse;
        const { data: equipmentRows, error: equipmentError } = equipmentResponse;

        if (servicesError) {
          return;
        }

        const normalizedRemoteData = (rows ?? []).map((row) => ({
          id: row.external_key,
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
            .map((row) => row.contracts)
            .filter(Boolean)
            .map((contract) => contract.display_name || contract.code),
        );

        setUserProfile(
          profileRow
            ? {
                fullName: profileRow.full_name,
                role: profileRow.app_role,
              }
            : null,
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
  }, [session, supabase]);

  useEffect(() => {
    if (!session) return;

    let active = true;

    async function fetchDashboardEntries() {
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
            let query = supabase
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
  }, [dashboardContract, dashboardDateFrom, dashboardDateTo, session, submitState.success, supabase]);

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
    function handleClickOutside(event) {
      if (!event.target.closest(".driver-picker")) {
        setOpenDriverServiceId(null);
        setDriverQuery("");
        setOpenEquipmentServiceId(null);
        setEquipmentQuery("");
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleSignIn(eventOrMode) {
    const mode = typeof eventOrMode === "string" ? eventOrMode : "login";
    if (typeof eventOrMode !== "string") {
      eventOrMode.preventDefault();
    }

    setAuthError("");
    setAuthNotice("");

    if (mode === "reset") {
      if (!email) {
        setAuthError("Ingresa tu correo para enviarte el enlace de recuperacion.");
        return;
      }

      setAuthLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });

      if (error) {
        setAuthError("No pudimos enviar el correo de recuperacion.");
      } else {
        setAuthNotice("Te enviamos un correo para restablecer tu contraseña.");
      }

      setAuthLoading(false);
      return;
    }

    setAuthLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setAuthError("No fue posible iniciar sesión. Revisa tu correo y contraseña.");
    }

    setAuthLoading(false);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setSelectedContract("");
    setSelectedShift("");
    setServiceDrafts({});
    setExpandedServiceId(null);
    setDriverQuery("");
    setOpenDriverServiceId(null);
    setEquipmentQuery("");
    setOpenEquipmentServiceId(null);
    setIsUserMenuOpen(false);
    setIsPasswordCardOpen(false);
  }

  async function handlePlanSubmit() {
    const globalFieldErrors = {};

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

    const fieldErrorsByService = {};
    const entriesToSubmit = [];

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

      if (!validation.isValid || !completed) {
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

    const {
      data: { session: currentSession },
    } = await supabase.auth.getSession();

    const apiFieldErrorsByService = {};

    for (const entry of entriesToSubmit) {
      const response = await submitServiceEntry(entry.payload, currentSession?.user?.id || "");
      
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

  async function handlePasswordUpdate(event) {
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

    setExportLoading(true);
    setExportError("");
    setExportSearched(true);

    try {
      const rows = await fetchAllPagedRows({
        pageSize: EXPORT_PAGE_SIZE,
        buildQuery: (from, to) => {
          let query = supabase
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
      Turno: formatShiftLabel(row.shift),
      Contrato: row.contract_code ?? "",
      Servicio: row.service_operational_name ?? "",
      "Nombre contractual": row.service_contractual_name ?? "",
      "Categoria contractual": row.service_category ?? "",
      "Empresa usuaria": row.service_company ?? "",
      Conductor: row.driver_name ?? "",
      "RUT / Documento": row.driver_document ?? "",
      Area: row.driver_area ?? "",
      "Estado de turno": formatTurnStatusLabel(row.driver_shift_status),
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

  if (!sessionReady) {
    return <main className="loading-shell">Cargando plataforma...</main>;
  }

  if (!session) {
    return <main className="loading-shell">Acceso denegado. Debes iniciar sesión.</main>;
  }

  const categoriesCount = new Set(eligibleServices.map((item) => item.category)).size;
  const shiftLabel = selectedShift ? selectedShift.toUpperCase() : "Sin turno";
  const displayName = userProfile?.fullName || session.user.user_metadata?.full_name || formatDisplayName(session.user.email);
  const displayRole = userProfile?.role === "admin" ? "Administrador" : "Operaciones";
  const dashboardCompletionRate =
    dashboardSummary.totalExpected > 0 ? Math.round((dashboardSummary.totalPlanned / dashboardSummary.totalExpected) * 100) : 0;
  const exportHasRows = exportRows.length > 0;
  const allServicesComplete =
    eligibleServices.length > 0 &&
    eligibleServices.every((service) => {
      const draft = getDraft(service.id);
      return Boolean(getDriverById(draft.driverId) && getEquipmentByCode(draft.equipmentCode));
    });

  const operationsSummaryControls = (
    <section className="operations-page-shell">
      <section className="dashboard-hero operations-page-hero">
        <div className="dashboard-hero__copy">
          <h3>Resumen</h3>
          <p>Indicadores operacionales alimentados desde los registros históricos de planificación.</p>
        </div>
      </section>

      <section className="operations-control-grid operations-control-grid--summary">
        <section className="panel operations-panel">
          <p className="panel-label">Resumen</p>
          <label>
            <span>Contrato</span>
            <select value={dashboardContract} onChange={(event) => setDashboardContract(event.target.value)}>
              <option value="">Todos los contratos</option>
              {contractOptions.map((contract) => (
                <option key={contract} value={contract}>
                  {contract}
                </option>
              ))}
            </select>
          </label>
          <div className="operations-inline-fields">
            <DatePickerField label="Desde" value={dashboardDateFrom} onChange={setDashboardDateFrom} today={today} />
            <DatePickerField label="Hasta" value={dashboardDateTo} onChange={setDashboardDateTo} today={today} />
          </div>
        </section>

        <section className="panel operations-panel metrics operations-metrics-panel">
          <article>
            <span>Planificados</span>
            <strong>{dashboardSummary.totalPlanned}</strong>
          </article>
          <article>
            <span>Base habilitada</span>
            <strong>{dashboardSummary.totalExpected}</strong>
          </article>
          <article>
            <span>Cobertura</span>
            <strong>{dashboardCompletionRate}%</strong>
          </article>
        </section>
      </section>
    </section>
  );

  const operationsBaseControls = (
    <section className="operations-page-shell">
      <section className="dashboard-hero operations-page-hero">
        <div className="dashboard-hero__copy">
          <h3>Registro de servicios base</h3>
          <p>Define fecha, turno y contrato para habilitar la planificación operativa del día.</p>
        </div>
      </section>

      <section className="operations-control-grid operations-control-grid--base">
        <section className="panel operations-panel jornada-panel">
          <p className="panel-label">Jornada</p>
          <div className="field-grid">
            <DatePickerField label="Fecha" value={selectedDateValue} onChange={setSelectedDateValue} today={today} />
            <label>
              <span>Turno</span>
              <select value={selectedShift} onChange={(event) => setSelectedShift(event.target.value)} aria-invalid={Boolean(submitState.fieldErrors.shift)}>
                <option value="">Selecciona turno</option>
                <option value="am">AM</option>
                <option value="pm">PM</option>
              </select>
            </label>
          </div>
          {submitState.fieldErrors.serviceDate || submitState.fieldErrors.shift ? (
            <div className="panel-inline-errors">
              <p className="field-error">{submitState.fieldErrors.serviceDate || ""}</p>
              <p className="field-error">{submitState.fieldErrors.shift || ""}</p>
            </div>
          ) : null}
        </section>

        <section className="panel operations-panel">
          <p className="panel-label">Ingreso</p>
          <label>
            <span>Contrato</span>
            <select value={selectedContract} onChange={(event) => setSelectedContract(event.target.value)} aria-invalid={Boolean(submitState.fieldErrors.contractCode)}>
              <option value="">Selecciona contrato</option>
              {contractOptions.map((contract) => (
                <option key={contract} value={contract}>
                  {contract}
                </option>
              ))}
            </select>
          </label>
          {submitState.fieldErrors.contractCode ? <p className="field-error">{submitState.fieldErrors.contractCode}</p> : null}
        </section>

        <section className="panel operations-panel metrics operations-metrics-panel">
          <article>
            <span>Servicios del día</span>
            <strong>{eligibleServices.length}</strong>
          </article>
          <article>
            <span>Contrato activo</span>
            <strong>{selectedContract || "Todos"}</strong>
          </article>
          <article>
            <span>Categorías</span>
            <strong>{categoriesCount}</strong>
          </article>
        </section>
      </section>
    </section>
  );

  const operationsExportControls = (
    <section className="operations-page-shell">
      <section className="dashboard-hero operations-page-hero">
        <div className="dashboard-hero__copy">
          <h3>Exportador de Información</h3>
          <p>Consulta información histórica por contrato y rango de fechas, revisa una vista previa y exporta el resultado a Excel.</p>
        </div>
      </section>

      <section className="operations-control-grid operations-control-grid--export">
        <section className="panel operations-panel">
          <p className="panel-label">Exportador</p>
          <label>
            <span>Contrato</span>
            <select value={exportContract} onChange={(event) => setExportContract(event.target.value)}>
              <option value="">Todos los contratos</option>
              {contractOptions.map((contract) => (
                <option key={contract} value={contract}>
                  {contract}
                </option>
              ))}
            </select>
          </label>
          <div className="operations-inline-fields">
            <DatePickerField label="Desde" value={exportDateFrom} onChange={setExportDateFrom} today={today} />
            <DatePickerField label="Hasta" value={exportDateTo} onChange={setExportDateTo} today={today} />
          </div>
          <div className="export-sidebar-actions">
            <button type="button" className="ghost-button ghost-button--full" onClick={handleExportSearch} disabled={exportLoading}>
              {exportLoading ? "Buscando..." : "Buscar"}
            </button>
            <button type="button" className="primary-button export-button" onClick={handleExportExcel} disabled={!exportHasRows || exportLoading}>
              Exportar Excel
            </button>
          </div>
          {exportError ? <p className="field-error">{exportError}</p> : null}
        </section>

        <section className="panel operations-panel metrics operations-metrics-panel">
          <article>
            <span>Filas encontradas</span>
            <strong>{exportRows.length}</strong>
          </article>
          <article>
            <span>Contrato</span>
            <strong>{exportContract || "Todos"}</strong>
          </article>
          <article>
            <span>Rango</span>
            <strong>{exportDateFrom && exportDateTo ? `${exportDateFrom} a ${exportDateTo}` : "Sin rango"}</strong>
          </article>
        </section>
      </section>
    </section>
  );

  const operationsSpecialControls = (
    <section className="operations-page-shell">
      <section className="dashboard-hero operations-page-hero">
        <div className="dashboard-hero__copy">
          <h3>Registro de servicios especiales</h3>
          <p>Espacio reservado para el flujo de servicios no base. El diseño funcional aún no está definido.</p>
        </div>
      </section>
    </section>
  );

  return (
    <div className="operaciones-module-shell">
      <main className="content operaciones-content">

        {activePage === "resumen" ? (
          <>
            {operationsSummaryControls}
            <section className="dashboard-shell">
            <section className="dashboard-cards">
              <article className="dashboard-card">
                <span>Servicios planificados</span>
                <strong>{dashboardSummary.totalPlanned}</strong>
                <small>Registros guardados en el rango seleccionado.</small>
              </article>
              <article className="dashboard-card">
                <span>Servicios base habilitados</span>
                <strong>{dashboardSummary.totalExpected}</strong>
                <small>Servicios programables según periodicidad y contrato.</small>
              </article>
              <article className="dashboard-card">
                <span>Conductores en turno</span>
                <strong>{dashboardSummary.totalInTurn}</strong>
                <small>Conductores distintos marcados como en turno.</small>
              </article>
              <article className="dashboard-card">
                <span>Conductores fuera de turno</span>
                <strong>{dashboardSummary.totalOutOfTurn}</strong>
                <small>Conductores distintos marcados como fuera de turno.</small>
              </article>
            </section>

            <section className="dashboard-table-card">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Dashboard</p>
                  <h3>Servicios planificados vs base habilitada por contrato</h3>
                </div>
              </div>

              {dashboardError ? <p className="submit-feedback submit-feedback--error">{dashboardError}</p> : null}

              <div className="dashboard-table">
                <div className="dashboard-table__head">
                  <span>Contrato</span>
                  <span>Planificados</span>
                  <span>Base habilitada</span>
                  <span>En turno</span>
                  <span>Fuera de turno</span>
                  <span>Cobertura</span>
                </div>

                {dashboardLoading ? (
                  <div className="dashboard-table__row dashboard-table__row--empty">
                    <span>Cargando indicadores...</span>
                  </div>
                ) : dashboardSummary.byContract.length > 0 ? (
                  dashboardSummary.byContract.map((item) => (
                    <div key={item.contractCode} className="dashboard-table__row">
                      <strong>{item.contractCode}</strong>
                      <span>{item.plannedServices}</span>
                      <span>{item.expectedServices}</span>
                      <span>{item.inTurnWorkers}</span>
                      <span>{item.outOfTurnWorkers}</span>
                      <span>{item.completionRate}%</span>
                    </div>
                  ))
                ) : (
                  <div className="dashboard-table__row dashboard-table__row--empty">
                    <span>No hay datos para el rango seleccionado.</span>
                  </div>
                )}
              </div>
            </section>
            </section>
          </>
        ) : null}

        {activePage === "registros_base" ? (
          <>
            {operationsBaseControls}
            <section className="toolbar">
              <div className="toolbar-copy">
                <h3>Planificacion de Servicios - {selectedContract || "Sin contrato"} - {shiftLabel}</h3>
                <p>Para {formatLongDate(selectedDate)}.</p>
              </div>
              <div className="toolbar-actions">
                <button
                  type="button"
                  className={`primary-button submit-plan-button${allServicesComplete ? " is-ready" : ""}`}
                  onClick={handlePlanSubmit}
                  disabled={submitState.loading || !allServicesComplete}
                >
                  {submitState.loading ? "Enviando..." : "Enviar Planificacion"}
                </button>
              </div>
            </section>

            <section className="operation-workspace">
              {isPasswordCardOpen ? (
                <article className="reference-card">
                  <div className="section-head">
                    <div>
                      <p className="eyebrow">Cuenta</p>
                      <h3>Cambiar contraseña</h3>
                    </div>
                    <button
                      type="button"
                      className="close-icon-button"
                      aria-label="Cerrar cambio de contraseña"
                      onClick={() => {
                        setIsPasswordCardOpen(false);
                        setPasswordMessage("");
                        setNewPassword("");
                        setConfirmPassword("");
                      }}
                    >
                      ×
                    </button>
                  </div>

                  <form className="assignment-grid" onSubmit={handlePasswordUpdate}>
                    <label>
                      <span>Nueva contraseña</span>
                      <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
                    </label>
                    <label>
                      <span>Repite la contraseña</span>
                      <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
                    </label>
                    <div className="account-actions">
                      <button type="submit" className="primary-button" disabled={passwordLoading}>
                        {passwordLoading ? "Actualizando..." : "Actualizar contraseña"}
                      </button>
                    </div>
                    <p className="account-message">{passwordMessage || "Puedes cambiar tu contraseña sin salir de la plataforma."}</p>
                  </form>
                </article>
              ) : null}

              {eligibleServices.length === 0 ? (
                <article className="service-module service-module--empty">
                  <p className="helper-copy">Selecciona contrato, fecha y turno para habilitar servicios operacionales.</p>
                </article>
              ) : (
                eligibleServices.map((service) => {
                  const draft = getDraft(service.id);
                  const selectedDriver = getDriverById(draft.driverId);
                  const selectedEquipment = getEquipmentByCode(draft.equipmentCode);
                  const isExpanded = expandedServiceId === service.id;
                  const isComplete = Boolean(selectedDriver && selectedEquipment);
                  const fieldErrors = submitState.fieldErrorsByService[service.id] || {};

                  return (
                    <article
                      key={service.id}
                      className={`service-module${isExpanded ? " is-expanded" : " is-collapsed"}${isComplete ? " is-complete" : ""}`}
                    >
                      <div className="service-module__header">
                        <button
                          type="button"
                          className="service-module__toggle"
                          aria-expanded={isExpanded}
                          onClick={() => {
                            setExpandedServiceId((current) => (current === service.id ? null : service.id));
                            setOpenDriverServiceId(null);
                            setOpenEquipmentServiceId(null);
                            setDriverQuery("");
                            setEquipmentQuery("");
                          }}
                        >
                          <span className="service-module__toggle-mark">−</span>
                        </button>

                        {!isExpanded ? (
                          <div className="service-module__summary">
                            <strong className={`service-module__service-pill${isComplete ? " is-complete" : " is-pending"}`}>{service.service}</strong>
                            <span>{selectedDriver?.fullName || "Sin conductor"}</span>
                            <span>{selectedEquipment?.code || "Sin equipo"}</span>
                          </div>
                        ) : (
                          <div className="service-module__summary service-module__summary--expanded" />
                        )}

                        <div className="service-module__header-side">
                          {isComplete ? <span className="service-module__complete-dot" aria-label="Servicio completo" /> : null}
                          <span className="badge badge-soft">{service.schedule ?? "Sin periodicidad"}</span>
                        </div>
                      </div>

                      {isExpanded ? (
                        <div className="service-module__body">
                          <div className="service-assignment-row">
                            <label className="service-assignment-field">
                              <span>Servicio</span>
                              <input type="text" readOnly value={service.service} className="compact-readonly" />
                            </label>

                            <label className="service-assignment-field">
                              <span>Nombre contractual</span>
                              <input type="text" readOnly value={service.contractName ?? ""} className="compact-readonly" />
                            </label>

                            <label className="service-assignment-field">
                              <span>Categoría contractual</span>
                              <input type="text" readOnly value={service.category ?? ""} className="compact-readonly" />
                            </label>

                            <label className="service-assignment-field">
                              <span>Empresa usuaria</span>
                              <input type="text" readOnly value={service.company ?? ""} className="compact-readonly" />
                            </label>
                          </div>

                          <div className="service-reference-row service-reference-row--driver">
                            <label className="service-assignment-field">
                              <span>Conductor</span>
                              <div className="driver-picker">
                                <button
                                  type="button"
                                  className="driver-picker__trigger"
                                  aria-expanded={selectedDriver ? false : openDriverServiceId === service.id}
                                  aria-invalid={Boolean(fieldErrors.driverName)}
                                  onClick={() => {
                                    if (selectedDriver) return;
                                    setOpenDriverServiceId((current) => (current === service.id ? null : service.id));
                                    setOpenEquipmentServiceId(null);
                                    setEquipmentQuery("");
                                  }}
                                >
                                  <span className="driver-picker__value">{selectedDriver?.fullName || "Selecciona conductor"}</span>
                                  {selectedDriver ? (
                                    <span
                                      className="driver-picker__clear"
                                      role="button"
                                      tabIndex={0}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        updateDraft(service.id, { driverId: "", driverShiftStatus: "en_turno" });
                                        setDriverQuery("");
                                        setOpenDriverServiceId(null);
                                      }}
                                      onKeyDown={(event) => {
                                        if (event.key === "Enter" || event.key === " ") {
                                          event.preventDefault();
                                          event.stopPropagation();
                                          updateDraft(service.id, { driverId: "", driverShiftStatus: "en_turno" });
                                          setDriverQuery("");
                                          setOpenDriverServiceId(null);
                                        }
                                      }}
                                      aria-label="Quitar conductor seleccionado"
                                    >
                                      ×
                                    </span>
                                  ) : null}
                                  {!selectedDriver ? <span className="driver-picker__chevron" /> : null}
                                </button>

                                {openDriverServiceId === service.id ? (
                                  <div className="driver-picker__popover">
                                    <input
                                      type="text"
                                      value={driverQuery}
                                      onChange={(event) => setDriverQuery(event.target.value)}
                                      placeholder="Buscar por nombre o apellidos"
                                      className="driver-picker__search"
                                      autoFocus
                                    />
                                    <div className="driver-picker__list" role="listbox" aria-label="Resultados de conductor">
                                      {filteredDrivers.length > 0 ? (
                                        filteredDrivers.map((employee) => (
                                          <button
                                            key={employee.id}
                                            type="button"
                                            className={`driver-picker__option${employee.id === draft.driverId ? " is-selected" : ""}`}
                                            onClick={() => {
                                              updateDraft(service.id, { driverId: employee.id });
                                              setOpenDriverServiceId(null);
                                              setDriverQuery("");
                                            }}
                                          >
                                            {employee.fullName}
                                          </button>
                                        ))
                                      ) : (
                                        <p className="driver-picker__empty">No se encontraron conductores.</p>
                                      )}
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            </label>

                            <label className="service-assignment-field">
                              <span>RUT / Documento</span>
                              <input type="text" readOnly value={selectedDriver?.documentNumber ?? ""} className="compact-readonly" />
                            </label>

                            <label className="service-assignment-field">
                              <span>Área</span>
                              <input type="text" readOnly value={selectedDriver?.areaName || selectedDriver?.areaCode || ""} className="compact-readonly" />
                            </label>

                            <label className="service-assignment-field">
                              <span>Estado de turno</span>
                              <div className={`turn-status-control turn-status-control--${draft.driverShiftStatus}`}>
                                <select
                                  value={draft.driverShiftStatus}
                                  onChange={(event) => updateDraft(service.id, { driverShiftStatus: event.target.value })}
                                  aria-invalid={Boolean(fieldErrors.driverShiftStatus)}
                                >
                                  <option value="en_turno">En Turno</option>
                                  <option value="fuera_de_turno">Fuera de Turno</option>
                                </select>
                                <span className="turn-status-control__dot" aria-hidden="true" />
                              </div>
                            </label>
                          </div>

                          <div className="service-reference-row service-reference-row--equipment">
                            <label className="service-assignment-field">
                              <span>Equipo</span>
                              <div className="driver-picker">
                                <button
                                  type="button"
                                  className="driver-picker__trigger"
                                  aria-expanded={selectedEquipment ? false : openEquipmentServiceId === service.id}
                                  aria-invalid={Boolean(fieldErrors.equipmentCode)}
                                  onClick={() => {
                                    if (selectedEquipment) return;
                                    setOpenEquipmentServiceId((current) => (current === service.id ? null : service.id));
                                    setOpenDriverServiceId(null);
                                    setDriverQuery("");
                                  }}
                                >
                                  <span className="driver-picker__value">{selectedEquipment?.code || "Selecciona equipo"}</span>
                                  {selectedEquipment ? (
                                    <span
                                      className="driver-picker__clear"
                                      role="button"
                                      tabIndex={0}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        updateDraft(service.id, { equipmentCode: "" });
                                        setEquipmentQuery("");
                                        setOpenEquipmentServiceId(null);
                                      }}
                                      onKeyDown={(event) => {
                                        if (event.key === "Enter" || event.key === " ") {
                                          event.preventDefault();
                                          event.stopPropagation();
                                          updateDraft(service.id, { equipmentCode: "" });
                                          setEquipmentQuery("");
                                          setOpenEquipmentServiceId(null);
                                        }
                                      }}
                                      aria-label="Quitar equipo seleccionado"
                                    >
                                      ×
                                    </span>
                                  ) : null}
                                  {!selectedEquipment ? <span className="driver-picker__chevron" /> : null}
                                </button>

                                {openEquipmentServiceId === service.id ? (
                                  <div className="driver-picker__popover">
                                    <input
                                      type="text"
                                      value={equipmentQuery}
                                      onChange={(event) => setEquipmentQuery(event.target.value)}
                                      placeholder="Buscar por equipo, patente o tipo"
                                      className="driver-picker__search"
                                      autoFocus
                                    />
                                    <div className="driver-picker__list" role="listbox" aria-label="Resultados de equipo">
                                      {filteredEquipment.length > 0 ? (
                                        filteredEquipment.map((item) => (
                                          <button
                                            key={item.code}
                                            type="button"
                                            className={`driver-picker__option${item.code === draft.equipmentCode ? " is-selected" : ""}`}
                                            onClick={() => {
                                              updateDraft(service.id, { equipmentCode: item.code });
                                              setOpenEquipmentServiceId(null);
                                              setEquipmentQuery("");
                                            }}
                                          >
                                            {item.code}
                                          </button>
                                        ))
                                      ) : (
                                        <p className="driver-picker__empty">No se encontraron equipos.</p>
                                      )}
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            </label>

                            <label className="service-assignment-field">
                              <span>Tipo</span>
                              <input type="text" readOnly value={selectedEquipment?.type ?? ""} className="compact-readonly" />
                            </label>

                            <label className="service-assignment-field">
                              <span>Patente</span>
                              <input type="text" readOnly value={selectedEquipment?.plate ?? ""} className="compact-readonly" />
                            </label>

                            <label className="service-assignment-field">
                              <span>Cliente actual</span>
                              <input type="text" readOnly value={selectedEquipment?.currentClient ?? ""} className="compact-readonly" />
                            </label>
                          </div>

                          <div className="field-errors-grid field-errors-grid--service field-errors-grid--compact">
                            <span />
                            <span />
                            <span />
                            <span />
                          </div>
                          <div className="field-errors-grid field-errors-grid--service field-errors-grid--compact">
                            {fieldErrors.driverName ? <p className="field-error">{fieldErrors.driverName}</p> : <span />}
                            <span />
                            <span />
                            {fieldErrors.driverShiftStatus ? <p className="field-error">{fieldErrors.driverShiftStatus}</p> : <span />}
                          </div>
                          <div className="field-errors-grid field-errors-grid--service field-errors-grid--compact">
                            {fieldErrors.equipmentCode ? <p className="field-error">{fieldErrors.equipmentCode}</p> : <span />}
                            <span />
                            <span />
                            <span />
                          </div>
                          {openDriverServiceId === service.id && driverQuery ? <p className="helper-copy helper-copy--tight">{filteredDrivers.length} conductor(es) encontrados.</p> : null}
                          {openEquipmentServiceId === service.id && equipmentQuery ? <p className="helper-copy helper-copy--tight">{filteredEquipment.length} equipo(s) encontrados.</p> : null}
                        </div>
                      ) : null}
                    </article>
                  );
                })
              )}
              {submitState.error ? <p className="submit-feedback submit-feedback--error">{submitState.error}</p> : null}
              {submitState.success ? <p className="submit-feedback submit-feedback--success">{submitState.success}</p> : null}
            </section>
          </>
        ) : null}

        {activePage === "registros_especiales" ? (
          <section className="specials-shell">
            {operationsSpecialControls}

            <article className="reference-card">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Pendiente</p>
                  <h3>Modulo en definición</h3>
                </div>
              </div>
              <p className="helper-copy">
                Esta página quedará destinada al registro de servicios especiales. La estructura de navegación ya la separa del flujo base para que el diseño posterior no mezcle reglas de negocio distintas.
              </p>
            </article>
          </section>
        ) : null}

        {activePage === "exportador" ? (
          <section className="export-shell">
            {operationsExportControls}

            <article className="dashboard-table-card">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Vista previa</p>
                  <h3>Planificaciones históricas</h3>
                </div>
              </div>

              {exportError ? <p className="submit-feedback submit-feedback--error">{exportError}</p> : null}

              {exportLoading ? (
                <div className="export-empty-state">
                  <span>Cargando vista previa...</span>
                </div>
              ) : exportHasRows ? (
                <div className="dashboard-table dashboard-table--export">
                  <div className="dashboard-table__head dashboard-table__head--export">
                    <span>Fecha</span>
                    <span>Turno</span>
                    <span>Contrato</span>
                    <span>Servicio</span>
                    <span>Conductor</span>
                    <span>Estado</span>
                    <span>Equipo</span>
                    <span>Patente</span>
                  </div>

                  {exportRows.map((row, index) => (
                    <div key={`${row.service_date}-${row.contract_code}-${row.service_operational_name}-${row.equipment_code}-${index}`} className="dashboard-table__row dashboard-table__row--export">
                      <span>{row.service_date}</span>
                      <span>{formatShiftLabel(row.shift)}</span>
                      <strong>{row.contract_code || ""}</strong>
                      <span>{row.service_operational_name || ""}</span>
                      <span>{row.driver_name || ""}</span>
                      <span>{formatTurnStatusLabel(row.driver_shift_status)}</span>
                      <span>{row.equipment_code || ""}</span>
                      <span>{row.equipment_plate || ""}</span>
                    </div>
                  ))}
                </div>
              ) : exportSearched ? (
                <div className="export-empty-state">
                  <span>No hay registros para el criterio seleccionado.</span>
                </div>
              ) : (
                <div className="export-empty-state">
                  <span>Define contrato y rango de fechas, luego presiona Buscar para cargar la vista previa.</span>
                </div>
              )}
            </article>
          </section>
        ) : null}
      </main>
    </div>
  );
}
