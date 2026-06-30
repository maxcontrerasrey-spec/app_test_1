export interface ServiceEntryPayload {
  contractCode?: string;
  shift?: string;
  serviceDate?: string;
  serviceExternalKey?: number;
  driverName?: string;
  driverDocument?: string;
  driverArea?: string;
  equipmentCode?: string;
}

export interface CleanedServiceEntryPayload {
  contractCode: string;
  shift: string;
  serviceDate: string;
  serviceExternalKey: number;
  driverName: string;
  driverDocument: string;
  driverArea: string;
  equipmentCode: string;
}

export interface ServiceEntryValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  cleaned: CleanedServiceEntryPayload | null;
}

const SHIFT_OPTIONS = new Set(["am", "pm"]);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DRIVER_PATTERN = /^[A-Za-zÁÉÍÓÚáéíóúÑñ0-9.'\- ]{2,140}$/;
const EQUIPMENT_PATTERN = /^[A-Za-z0-9._\-\/ ]{2,50}$/;

function sanitizeText(value: string | null | undefined): string {
  return (value ?? "").toString().trim().replace(/\s+/g, " ");
}

function isValidDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function validateServiceEntryPayload(payload: unknown): ServiceEntryValidationResult {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {
      isValid: false,
      errors: {
        payload: "El cuerpo de la planificación no es válido.",
      },
      cleaned: null,
    };
  }

  const record = payload as ServiceEntryPayload;

  const cleaned: CleanedServiceEntryPayload = {
    contractCode: sanitizeText(record.contractCode),
    shift: sanitizeText(record.shift).toLowerCase(),
    serviceDate: sanitizeText(record.serviceDate),
    serviceExternalKey: Number(record.serviceExternalKey),
    driverName: sanitizeText(record.driverName),
    driverDocument: sanitizeText(record.driverDocument),
    driverArea: sanitizeText(record.driverArea),
    equipmentCode: sanitizeText(record.equipmentCode).toUpperCase(),
  };

  const errors: Record<string, string> = {};

  if (!cleaned.contractCode || cleaned.contractCode.length > 120) {
    errors.contractCode = "Selecciona un contrato válido.";
  }

  if (!SHIFT_OPTIONS.has(cleaned.shift)) {
    errors.shift = "Selecciona un turno válido.";
  }

  if (!isValidDate(cleaned.serviceDate)) {
    errors.serviceDate = "Selecciona una fecha válida.";
  }

  if (!Number.isInteger(cleaned.serviceExternalKey) || cleaned.serviceExternalKey <= 0) {
    errors.serviceExternalKey = "Selecciona un servicio válido.";
  }

  if (!cleaned.driverName || !DRIVER_PATTERN.test(cleaned.driverName)) {
    errors.driverName = "Selecciona un conductor válido.";
  }

  if (cleaned.driverDocument.length > 50) {
    errors.driverDocument = "El documento del conductor no es válido.";
  }

  if (cleaned.driverArea.length > 160) {
    errors.driverArea = "El área del conductor no es válida.";
  }

  if (!cleaned.equipmentCode || !EQUIPMENT_PATTERN.test(cleaned.equipmentCode)) {
    errors.equipmentCode = "Selecciona un equipo válido.";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    cleaned: Object.keys(errors).length === 0 ? cleaned : null,
  };
}
