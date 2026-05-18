// @ts-nocheck

const SHIFT_OPTIONS = new Set(["am", "pm"]);
const DRIVER_SHIFT_STATUS_OPTIONS = new Set(["en_turno", "fuera_de_turno"]);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DRIVER_PATTERN = /^[A-Za-zÁÉÍÓÚáéíóúÑñ0-9.'\- ]{2,140}$/;
const EQUIPMENT_PATTERN = /^[A-Za-z0-9._\-\/ ]{2,50}$/;

function sanitizeText(value) {
  return (value ?? "").toString().trim().replace(/\s+/g, " ");
}

function isValidDate(value) {
  if (!DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function validateServiceEntryPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {
      isValid: false,
      errors: {
        payload: "El cuerpo de la planificación no es válido.",
      },
      cleaned: null,
    };
  }

  const cleaned = {
    contractCode: sanitizeText(payload?.contractCode),
    shift: sanitizeText(payload?.shift).toLowerCase(),
    serviceDate: sanitizeText(payload?.serviceDate),
    serviceExternalKey: Number(payload?.serviceExternalKey),
    driverName: sanitizeText(payload?.driverName),
    driverDocument: sanitizeText(payload?.driverDocument),
    driverArea: sanitizeText(payload?.driverArea),
    driverShiftStatus: sanitizeText(payload?.driverShiftStatus).toLowerCase(),
    equipmentCode: sanitizeText(payload?.equipmentCode).toUpperCase(),
  };

  const errors = {};

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

  if (!DRIVER_SHIFT_STATUS_OPTIONS.has(cleaned.driverShiftStatus)) {
    errors.driverShiftStatus = "Selecciona un estado de turno válido.";
  }

  if (!cleaned.equipmentCode || !EQUIPMENT_PATTERN.test(cleaned.equipmentCode)) {
    errors.equipmentCode = "Selecciona un equipo válido.";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    cleaned,
  };
}
