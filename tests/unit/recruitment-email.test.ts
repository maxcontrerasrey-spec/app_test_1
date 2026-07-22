import { describe, expect, it } from "vitest";
import {
  getCandidateEmailValidationMessage,
  isValidCandidateEmail,
  normalizeCandidateEmail,
  validateOptionalCandidateEmail
} from "../../src/modules/recruitment/lib/candidateEmail";

describe("candidateEmail", () => {
  it("normaliza comas finales de dominio y espacios antes de validar", () => {
    expect(normalizeCandidateEmail("  Persona@Dominio,cl ")).toBe("persona@dominio.cl");
    expect(isValidCandidateEmail("Persona@Dominio,cl")).toBe(true);
  });

  it("permite emails opcionales vacios sin aceptar formatos invalidos", () => {
    expect(validateOptionalCandidateEmail("")).toEqual({ normalized: "", isValid: true });
    expect(validateOptionalCandidateEmail("persona@sin-dominio")).toEqual({
      normalized: "persona@sin-dominio",
      isValid: false
    });
  });

  it("retorna mensaje operativo solo cuando el valor no es corregible", () => {
    expect(getCandidateEmailValidationMessage("Email personal", "persona@dominio.cl")).toBe("");
    expect(getCandidateEmailValidationMessage("Email personal", "persona@dominio")).toContain(
      "Email personal no tiene un formato valido"
    );
  });
});
