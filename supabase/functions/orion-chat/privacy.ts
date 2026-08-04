import { ORION_PROVIDER_SAFE_FIELDS } from "./erpSchema.ts";

const PROVIDER_STRUCTURAL_FIELDS = new Set([
  "table",
  "columns",
  "rows",
  "returned_rows",
  "limit",
  "error",
  "document_name",
  "content",
  "similarity",
  "Cargo",
  "Estado",
  "Total Casos",
  "Total Vacantes Solicitadas",
  "Total Vacantes Llenadas",
  "Caso de Contratación",
  "Estado del Caso",
  "Etapa Actual",
  "Idoneidad",
  "Seleccionado"
]);

const PROVIDER_ALLOWED_FIELDS = new Set([
  ...ORION_PROVIDER_SAFE_FIELDS,
  ...PROVIDER_STRUCTURAL_FIELDS
]);

const RUT_PATTERN = /\b\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]\b/g;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const CHILEAN_PHONE_PATTERN = /(?<!\d)(?:\+?56[\s.-]?)?(?:9[\s.-]?)?\d{4}[\s.-]?\d{4}(?!\d)/g;

export type ProviderPayloadRedaction = {
  value: unknown;
  processed: true;
  redacted: boolean;
  droppedFields: number;
};

export function redactProviderText(value: string) {
  return value
    .replace(RUT_PATTERN, "[rut-redacted]")
    .replace(EMAIL_PATTERN, "[email-redacted]")
    .replace(CHILEAN_PHONE_PATTERN, "[phone-redacted]");
}

function redactValue(value: unknown): Omit<ProviderPayloadRedaction, "processed"> {
  if (typeof value === "string") {
    const redactedValue = redactProviderText(value);
    return {
      value: redactedValue,
      redacted: redactedValue !== value,
      droppedFields: 0
    };
  }

  if (Array.isArray(value)) {
    const items = value.map(redactValue);
    return {
      value: items.map((item) => item.value),
      redacted: items.some((item) => item.redacted),
      droppedFields: items.reduce((total, item) => total + item.droppedFields, 0)
    };
  }

  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    let redacted = false;
    let droppedFields = 0;

    for (const [key, entryValue] of Object.entries(value)) {
      if (!PROVIDER_ALLOWED_FIELDS.has(key)) {
        redacted = true;
        droppedFields += 1;
        continue;
      }

      const entry = redactValue(entryValue);
      output[key] = entry.value;
      redacted ||= entry.redacted;
      droppedFields += entry.droppedFields;
    }

    return { value: output, redacted, droppedFields };
  }

  return { value, redacted: false, droppedFields: 0 };
}

export function redactProviderToolPayload(value: unknown): ProviderPayloadRedaction {
  return { ...redactValue(value), processed: true };
}
