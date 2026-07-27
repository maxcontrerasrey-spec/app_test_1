import { describe, expect, it } from "vitest";
import {
  candidateStageFilterOptions,
  getNextStageOptions
} from "../../src/modules/recruitment/components/hiringControlViewUtils";

describe("recruitment stage options", () => {
  it("permite levantar contraindicacion medica sin bloquear el paso directo a documental", () => {
    expect(getNextStageOptions("medical_exams")).toEqual([
      "medical_contraindication_resolution",
      "document_review",
      "rejected",
      "withdrawn"
    ]);
  });

  it("desde levantamiento de contraindicacion solo permite continuar a documental o cerrar", () => {
    expect(getNextStageOptions("medical_contraindication_resolution")).toEqual([
      "document_review",
      "rejected",
      "withdrawn"
    ]);
  });

  it("expone la etapa en filtros de control de candidatos", () => {
    expect(candidateStageFilterOptions).toContainEqual({
      key: "medical_contraindication_resolution",
      label: "Levantamiento de Contraindicación"
    });
  });
});
