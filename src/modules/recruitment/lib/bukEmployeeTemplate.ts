import type { SelectOption } from "../../../shared/ui/forms/SelectField";
import templateData from "./bukEmployeeTemplateData.json";

type OptionLists = Record<string, string[]>;

const optionLists = templateData.optionLists as OptionLists;

function normalizeHeader(value: string) {
  return value.replace(/\*/g, "").trim().toLowerCase();
}

function toOptions(values: string[]): SelectOption[] {
  return values.map((value) => ({
    value,
    label: value
  }));
}

function getOptions(header: string): SelectOption[] {
  const normalizedHeader = normalizeHeader(header);
  const matchedEntry = Object.entries(optionLists).find(
    ([key]) => normalizeHeader(key) === normalizedHeader
  );

  return matchedEntry ? toOptions(matchedEntry[1]) : [];
}

export const bukEmployeeFieldOptions = {
  documentType: getOptions("Tipo de Documento"),
  gender: getOptions("Sexo"),
  nationality: getOptions("Nacionalidad"),
  maritalStatus: getOptions("Estado Civil"),
  region: getOptions("Región"),
  commune: getOptions("Comuna"),
  privateRole: getOptions("Rol Privado"),
  paymentMethod: getOptions("Forma de Pago"),
  bank: getOptions("Banco"),
  bankAccountType: getOptions("Tipo de Cuenta"),
  valeVistaType: getOptions("Tipo Vale Vista"),
  pensionRegime: getOptions("Régimen Previsional"),
  contributionFund: getOptions("Fondo de Cotización"),
  healthProvider: getOptions("Fonasa/Isapre"),
  afcRegime: getOptions("AFC"),
  retiredStatus: getOptions("Jubilado"),
  retirementRegime: getOptions("Régimen Jubilacion"),
  accountTwoFund: getOptions("Cuenta 2"),
  currency: getOptions("Moneda"),
  disabilityStatus: getOptions("En Situación de Discapacidad"),
  invalidityStatus: getOptions("En Situación de Invalidez"),
  familyAllowanceSection: getOptions("Tramo de Asignación"),
  shoeSize: getOptions("Numero Calzado"),
  pantsSize: getOptions("Talla Pantalón"),
  shirtSize: getOptions("Talla Polera")
} as const;

export const bukEmployeeTemplateHeaders = templateData.headers as string[];
