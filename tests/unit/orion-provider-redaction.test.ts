import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ORION_PROVIDER_SAFE_FIELDS,
  ORION_READABLE_TABLES
} from "../../supabase/functions/orion-chat/erpSchema";
import { redactProviderToolPayload } from "../../supabase/functions/orion-chat/privacy";

describe("ORION provider privacy contract", () => {
  it("aplica allowlist recursiva y elimina identidad de resultados de herramientas", () => {
    const result = redactProviderToolPayload([
      {
        "Nombre Candidato": "Persona Ejemplo",
        RUT: "11.111.111-1",
        "Caso de Contratación": "Operación Norte",
        "Estado del Caso": "open",
        rows: [
          {
            status: "active",
            email: "persona@example.com",
            phone: "+56 9 1234 5678"
          }
        ]
      }
    ]);

    expect(result.processed).toBe(true);
    expect(result.redacted).toBe(true);
    expect(result.droppedFields).toBe(4);
    expect(result.value).toEqual([
      {
        "Caso de Contratación": "Operación Norte",
        "Estado del Caso": "open",
        rows: [{ status: "active" }]
      }
    ]);
  });

  it("redacta patrones sensibles incluso dentro de contenido permitido", () => {
    const result = redactProviderToolPayload({
      content: "Contacto persona@example.com, +56 9 1234 5678, RUT 11.111.111-1"
    });

    expect(result.value).toEqual({
      content: "Contacto [email-redacted], [phone-redacted], RUT [rut-redacted]"
    });
  });

  it("no expone tablas personales ni PII en columnas por defecto del proveedor", () => {
    const forbiddenDefaults = [
      "full_name",
      "national_id",
      "email",
      "phone",
      "worker_name",
      "worker_rut",
      "approver_name",
      "actor_name",
      "comment",
      "file_path"
    ];

    expect("candidate_profiles" in ORION_READABLE_TABLES).toBe(false);
    for (const column of forbiddenDefaults) {
      expect(ORION_PROVIDER_SAFE_FIELDS.has(column), column).toBe(false);
    }
  });

  it("cablea todos los resultados de herramientas al redactor antes del proveedor", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "supabase/functions/orion-chat/index.ts"),
      "utf8"
    );

    expect(source).not.toMatch(/funcResult\s*=\s*JSON\.stringify/);
    expect(source.match(/funcResult\s*=\s*serializeProviderToolPayload/g)).toHaveLength(6);
    expect(source).not.toContain("sanitized: true");
  });
});
