import { formatRut, normalizeRut } from "../../../shared/lib/rut";
import type {
  CandidateBukProfileDetails,
  RecruitmentPersonnelToHireRow
} from "../services/hiringControl";
import templateData from "./bukEmployeeTemplateData.json";

type OptionLists = Record<string, string[]>;

type NominaSource = {
  candidate: RecruitmentPersonnelToHireRow;
  bukProfile: CandidateBukProfileDetails | null;
};

const employeeHeaders = templateData.headers as string[];
const optionLists = templateData.optionLists as OptionLists;
const dateHeaders = new Set([
  "Fecha de Nacimiento*",
  "Ingreso Compañía*",
  "Fecha de Inicio Cotización AFC",
  "Fecha Reconocimiento de Antigüedad",
  "Fecha Inicio Vacaciones Progresivas",
  "Fecha de notificación de Discapacidad",
  "Fecha de notificación de Invalidez",
  "Actualización Datos Personales"
]);

function looksLikeRut(value: string | null | undefined) {
  const normalized = normalizeRut(value);
  return normalized.length >= 7 && normalized.length <= 9;
}

function splitFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);

  if (parts.length >= 3) {
    return {
      firstName: parts.slice(0, -2).join(" "),
      lastName: parts[parts.length - 2],
      secondLastName: parts[parts.length - 1]
    };
  }

  if (parts.length === 2) {
    return {
      firstName: parts[0],
      lastName: parts[1],
      secondLastName: ""
    };
  }

  return {
    firstName: fullName,
    lastName: "",
    secondLastName: ""
  };
}

function normalizeLegacyMaritalStatus(value: string | null | undefined) {
  switch ((value ?? "").trim().toLowerCase()) {
    case "soltero":
    case "soltero(a)":
      return "Soltero";
    case "casado":
    case "casado(a)":
      return "Casado";
    case "divorciado":
    case "divorciado(a)":
      return "Divorciado";
    case "viudo":
    case "viudo(a)":
      return "Viudo";
    case "union_civil":
    case "unión civil":
      return "Acuerdo de Unión Civil";
    default:
      return value ?? "";
  }
}

function resolveDocumentType(
  bukProfile: CandidateBukProfileDetails | null,
  candidate: RecruitmentPersonnelToHireRow
) {
  if (bukProfile?.document_type?.trim()) {
    return bukProfile.document_type.trim();
  }

  return looksLikeRut(bukProfile?.document_number ?? candidate.national_id) ? "RUT" : "";
}

function resolveDocumentNumber(
  bukProfile: CandidateBukProfileDetails | null,
  candidate: RecruitmentPersonnelToHireRow
) {
  const sourceValue = bukProfile?.document_number ?? candidate.national_id ?? "";
  return looksLikeRut(sourceValue) ? formatRut(sourceValue) : sourceValue;
}

function formatDateForDisplay(date: Date) {
  return `${date.getDate().toString().padStart(2, "0")}-${(date.getMonth() + 1)
    .toString()
    .padStart(2, "0")}-${date.getFullYear()}`;
}

function toExcelDateValue(value: string | null | undefined) {
  if (!value?.trim()) {
    return "";
  }

  const normalized = value.includes("T") ? value.slice(0, 10) : value;
  const date = new Date(`${normalized}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const excelEpoch = Date.UTC(1899, 11, 30);
  return (date.getTime() - excelEpoch) / 86_400_000;
}

function toStringValue(value: string | number | null | undefined) {
  if (value == null) {
    return "";
  }

  return String(value).trim();
}

function buildEmployeeRow({ candidate, bukProfile }: NominaSource) {
  const fallbackName = splitFullName(candidate.full_name);
  const worker = bukProfile?.worker_file;

  const valuesByHeader: Record<string, string | number> = {
    "Tipo de Documento*": resolveDocumentType(bukProfile, candidate),
    "Número de Documento*": resolveDocumentNumber(bukProfile, candidate),
    "Apellido*": bukProfile?.last_name ?? fallbackName.lastName,
    "Segundo Apellido": bukProfile?.second_last_name ?? fallbackName.secondLastName,
    "Nombre*": bukProfile?.first_name ?? fallbackName.firstName,
    "Sexo*": bukProfile?.gender ?? "",
    "Nacionalidad*": bukProfile?.nationality ?? "",
    "Fecha de Nacimiento*": toExcelDateValue(bukProfile?.birth_date),
    "Estado Civil*": normalizeLegacyMaritalStatus(
      bukProfile?.marital_status
    ),
    "Dirección*": bukProfile?.address_line ?? "",
    "Región*": bukProfile?.region ?? "",
    "Comuna*": bukProfile?.district_or_commune ?? "",
    "Ciudad": bukProfile?.current_city ?? "",
    "Teléfono Particular": bukProfile?.phone ?? candidate.phone ?? "",
    "Teléfono Oficina": bukProfile?.office_phone ?? "",
    Email: bukProfile?.email ?? candidate.email ?? "",
    "Email Personal*": bukProfile?.personal_email ?? "",
    "País": bukProfile?.country ?? "Chile",
    Calle: bukProfile?.street_name ?? "",
    "Número de Calle": bukProfile?.street_number ?? "",
    "Depto / Oficina": bukProfile?.apartment_or_office ?? "",
    "Título": bukProfile?.education_title ?? "",
    Institución: bukProfile?.education_institution ?? "",
    "Código de Ficha*": bukProfile?.suggested_employee_code ?? worker?.employee_code ?? "",
    "Ingreso Compañía*": toExcelDateValue(
      worker?.company_entry_date ?? candidate.hired_at ?? candidate.stage_entered_at
    ),
    "Rol Privado*": worker?.private_role ?? "No",
    "Fecha de Inicio Cotización AFC": toExcelDateValue(worker?.afc_start_date),
    "Fecha Reconocimiento de Antigüedad": toExcelDateValue(worker?.seniority_recognition_date),
    "Fecha Inicio Vacaciones Progresivas": toExcelDateValue(
      worker?.progressive_vacation_start_date
    ),
    "Forma de Pago*": worker?.payment_method ?? "",
    Banco: worker?.bank_name ?? "",
    "Tipo de Cuenta": worker?.bank_account_type ?? "",
    "Número de Cuenta": worker?.bank_account_number ?? "",
    "Código de Sucursal": worker?.bank_branch_code ?? "",
    "Tipo Vale Vista": worker?.vale_vista_type ?? "",
    "Régimen Previsional*": worker?.pension_regime ?? "",
    "Fondo de Cotización": worker?.contribution_fund ?? "",
    "AFP Recaudadora": worker?.afp_collection_entity ?? "",
    "Aumentar la cotización en 1%*": worker?.increase_quote_one_percent ?? "No",
    "Fonasa/Isapre*": worker?.health_provider ?? "",
    "Plan Isapre UF*": worker?.health_plan_uf ?? "",
    "Plan Isapre Pesos*": worker?.health_plan_pesos ?? "",
    "Plan Isapre Porcentual*": worker?.health_plan_percentage ?? "",
    "AFC*": worker?.afc_regime ?? "Menos de 11 Años",
    Jubilado: worker?.retired_status ?? "",
    "Régimen Jubilacion*": worker?.retirement_regime ?? "",
    "Cuenta 2": worker?.account_two_fund ?? "",
    "Plan Cuenta 2": worker?.account_two_plan ?? "",
    Moneda: worker?.currency ?? "",
    "En Situación de Discapacidad": bukProfile?.disability_status ?? "",
    "Fecha de notificación de Discapacidad": toExcelDateValue(
      bukProfile?.disability_notice_date
    ),
    "En Situación de Invalidez": bukProfile?.invalidity_status ?? "",
    "Fecha de notificación de Invalidez": toExcelDateValue(
      bukProfile?.invalidity_notice_date
    ),
    "Carga Simple": worker?.simple_load_count ?? "",
    "Carga Maternal": worker?.maternal_load_count ?? "",
    "Carga Inválida": worker?.invalid_load_count ?? "",
    "Tramo de Asignación": worker?.family_allowance_section ?? "",
    "Actualización Datos Personales": toExcelDateValue(worker?.personal_data_update_date),
    "Inclusión Laboral": bukProfile?.labor_inclusion ?? "",
    "Numero Calzado": bukProfile?.shoe_size ?? "",
    "Talla Pantalón": bukProfile?.pants_size ?? "",
    "Talla Polera": bukProfile?.shirt_size ?? "",
    "Trabajador extranjero": bukProfile?.foreign_worker ?? ""
  };

  return employeeHeaders.map((header) => {
    const value = valuesByHeader[header];
    if (dateHeaders.has(header)) {
      return value;
    }

    return toStringValue(value);
  });
}

function buildEmployeeSheetRows(sources: NominaSource[]) {
  return [employeeHeaders, ...sources.map(buildEmployeeRow)];
}

function buildListsSheetRows() {
  const listHeaders = Object.keys(optionLists);
  const maxRows = Math.max(...listHeaders.map((header) => optionLists[header]?.length ?? 0), 0);

  return [
    listHeaders,
    ...Array.from({ length: maxRows }, (_, rowIndex) =>
      listHeaders.map((header) => optionLists[header]?.[rowIndex] ?? "")
    )
  ];
}

function autoFitColumns(rows: Array<Array<string | number>>) {
  return employeeHeaders.map((header, columnIndex) => {
    const width = rows.reduce((max, row) => {
      const cell = row[columnIndex];
      const cellValue =
        dateHeaders.has(header) && typeof cell === "number"
          ? formatDateForDisplay(new Date(Math.round((cell - 25569) * 86_400_000)))
          : toStringValue(cell);
      return Math.max(max, cellValue.length);
    }, header.length);

    return { wch: Math.min(Math.max(width + 2, 12), 28) };
  });
}

export async function exportBukNominaXls(sources: NominaSource[], fileName?: string) {
  const { utils, writeFile } = await import("@mylinkpi/xlsx");
  const workbook = utils.book_new();
  const employeeRows = buildEmployeeSheetRows(sources);
  const employeeSheet = utils.aoa_to_sheet(employeeRows);
  const listsRows = buildListsSheetRows();
  const listsSheet = utils.aoa_to_sheet(listsRows);

  employeeSheet["!cols"] = autoFitColumns(employeeRows);
  listsSheet["!cols"] = Object.keys(optionLists).map((header) => ({
    wch: Math.min(Math.max(header.length + 2, 16), 38)
  }));

  for (let rowIndex = 1; rowIndex < employeeRows.length; rowIndex += 1) {
    employeeHeaders.forEach((header, columnIndex) => {
      const cellAddress = utils.encode_cell({ r: rowIndex, c: columnIndex });
      const cell = employeeSheet[cellAddress];

      if (!cell) {
        return;
      }

      if (
        dateHeaders.has(header) &&
        typeof employeeRows[rowIndex][columnIndex] === "number"
      ) {
        cell.t = "n";
        cell.z = "dd-mm-yyyy";
      }
    });
  }

  utils.book_append_sheet(workbook, employeeSheet, "Empleados");
  utils.book_append_sheet(workbook, listsSheet, "Listas");

  const timestamp = new Date().toISOString().slice(0, 10);
  writeFile(workbook, fileName ?? `nomina-buk-${timestamp}.xls`, {
    bookType: "biff8"
  });
}
