import { describe, expect, it } from "vitest";
import {
  buildDerivedAddressLine,
  buildPersonDraft,
  buildWorkerDraft,
  collectMissingFields,
  parseNullableInteger,
  parseNullableNumber
} from "../../src/modules/recruitment/lib/candidateWorkerFileFormHelpers";

const candidate = {
  national_id: "12345678-5",
  full_name: "Maria Fernanda Soto Perez",
  current_city: "Calama",
  address_line: "Los Heroes 123",
  birth_date: "1990-01-01",
  nationality: "Chilena",
  marital_status: "soltero(a)",
  email: "maria@busesjm.com",
  personal_email: "maria.personal@example.com",
  phone: "+56911111111",
  region: "Antofagasta",
  district_or_commune: "Calama",
  emergency_contact_name: "Juan",
  emergency_contact_phone: "+56922222222",
  emergency_contact_relationship: "Padre",
  inclusion_notes: "",
  firefighter_status: "no",
  shirt_size: "M",
  pants_size: "42",
  shoe_size: "40",
  bank_name: "Banco Estado",
  bank_account_type: "Cuenta RUT",
  bank_account_number: "12345678",
  afp_name: "Habitat",
  health_provider: "Fonasa",
  worker_file: {
    contract_notes: "Turno 7x7"
  }
} as never;

const caseDetail = {
  case: {
    contract_name: "Codelco Division Ministro Hales",
    requested_entry_date: "2026-07-22",
    hiring_request: {
      start_date: "2026-07-23",
      shift_name: "7x7"
    }
  }
} as never;

describe("candidateWorkerFileFormHelpers", () => {
  it("deriva direccion compacta sin duplicar numeral", () => {
    expect(
      buildDerivedAddressLine({
        streetName: " Av. Balmaceda ",
        streetNumber: "#123",
        currentCity: " Calama "
      })
    ).toBe("Av. Balmaceda, #123, Calama");
  });

  it("construye persona priorizando perfil BUK y normalizando estado civil legado", () => {
    const draft = buildPersonDraft(candidate, {
      document_type: "",
      document_number: "123456785",
      first_name: null,
      last_name: null,
      second_last_name: null,
      gender: "Femenino",
      birth_date: null,
      nationality: null,
      marital_status: null,
      email: null,
      personal_email: null,
      phone: null,
      office_phone: null,
      country: null,
      address_line: null,
      district_or_commune: null,
      current_city: null,
      region: null,
      street_name: "Av. Balmaceda",
      street_number: "123",
      apartment_or_office: null,
      education_title: null,
      education_institution: null,
      emergency_contact_name: null,
      emergency_contact_phone: null,
      emergency_contact_relationship: null,
      disability_status: null,
      disability_notice_date: null,
      invalidity_status: null,
      invalidity_notice_date: null,
      inclusion_notes: null,
      labor_inclusion: null,
      firefighter_status: null,
      foreign_worker: null,
      shirt_size: null,
      pants_size: null,
      shoe_size: null,
      worker_file: null,
      suggested_employee_code: null
    } as never);

    expect(draft).toMatchObject({
      documentType: "RUT",
      documentNumber: "12.345.678-5",
      firstName: "Maria Fernanda",
      lastName: "Soto",
      secondLastName: "Perez",
      maritalStatus: "Soltero",
      addressLine: "Av. Balmaceda, #123, Calama"
    });
  });

  it("construye ficha trabajador con defaults BUK contractuales", () => {
    const draft = buildWorkerDraft(candidate, caseDetail, null);

    expect(draft).toMatchObject({
      projectName: "Codelco Division Ministro Hales",
      companyEntryDate: "2026-07-22",
      shiftName: "7x7",
      contractNotes: "Turno 7x7",
      contributionFund: "Habitat",
      healthProvider: "Fonasa",
      privateRole: "No",
      afcRegime: "Menos de 11 Años"
    });
  });

  it("parsea numeros opcionales y lista campos faltantes por etiqueta", () => {
    expect(parseNullableNumber("1,5")).toBe(1.5);
    expect(parseNullableInteger("12xyz")).toBe(12);
    expect(parseNullableNumber("abc")).toBeNull();
    expect(collectMissingFields({ name: "", rut: "123" }, [{ key: "name", label: "Nombre" }])).toEqual([
      "Nombre"
    ]);
  });
});
