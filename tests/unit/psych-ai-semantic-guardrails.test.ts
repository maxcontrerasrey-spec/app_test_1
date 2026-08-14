import { describe, expect, it } from "vitest";
import {
  buildDeterministicPsychSemanticOutput,
  buildPsychSemanticContext,
  classifyIpipTheoreticalLevel,
  deduplicateLimitations,
  validatePsychSemanticOutput,
} from "../../supabase/functions/_shared/psychAi/semantic.ts";
import { validateAndGuardPsychAIOutput } from "../../supabase/functions/_shared/psychAi/guardrails.ts";

const fixturePayload = {
  instruments: [
    {
      code: "IPIP16_105",
      result: {
        dimensions: {
          APE: { name: "Apertura a ideas y cambio", mean: 3.14 },
          APR: { name: "Aprensión", mean: 3.0 },
          ASE: { name: "Asertividad", mean: 3.14 },
          AUT: { name: "Autosuficiencia", mean: 3.0 },
          CAL: { name: "Calidez interpersonal", mean: 3.43 },
          NOR: { name: "Cumplimiento de normas", mean: 3.0 },
          CAU: { name: "Cautela interpersonal", mean: 3.14 },
          EST: { name: "Estabilidad emocional", mean: 3.33 },
          GRE: { name: "Sociabilidad grupal", mean: 3.0 },
          IMA: { name: "Imaginación", mean: 3.29 },
          ANA: { name: "Análisis y aprendizaje", mean: 2.86 },
          ORD: { name: "Orden y perfeccionismo", mean: 3.33 },
          RES: { name: "Reserva personal", mean: 3.0 },
          SEG: { name: "Seguridad social", mean: 3.29 },
          SEN: { name: "Sensibilidad estética y emocional", mean: 2.57 },
          TEN: { name: "Tensión e irritabilidad", mean: 2.83 },
        },
      },
    },
    {
      code: "IPIP_IPC_32",
      result: {
        labor_profile: {
          styles: {
            Estable: 3.38,
            Influyente: 3.13,
            Analítico: 2.88,
            Directivo: 1.88,
          },
        },
      },
    },
    {
      code: "BARRATT_BIS11_30",
      result: { kind: "barratt", total: 70, classification: "Sobre el promedio" },
    },
    {
      code: "PRP_EMAIL_FORM_A_30",
      result: { kind: "prp", raw_total: 90 },
    },
  ],
};

function validOutput() {
  return {
    profile_summary: "Síntesis prudente basada en evidencia calculada por ERP.",
    strengths: [
      {
        title: "Calidez interpersonal",
        text: "Calidez interpersonal se ubica en nivel alto del rango teórico, sin comparación poblacional.",
        evidence_ids: ["ev_ipip16_CAL"],
      },
    ],
    points_to_explore: [
      {
        title: "Cumplimiento normativo por criticidad del cargo",
        text: "Cumplimiento de normas está en nivel descriptivo intermedio del rango teórico; por criticidad del cargo se profundiza en entrevista, sin clasificarlo como déficit.",
        evidence_ids: ["ev_ipip16_NOR"],
      },
      {
        title: "BIS-11",
        text: "BIS-11 obtiene 70 con clasificación SOBRE_EL_PROMEDIO; corresponde profundizarlo por contexto del cargo.",
        evidence_ids: ["ev_bis11_total"],
      },
      {
        title: "PRP",
        text: "Resultado pendiente de interpretación profesional debido a que no existe definición/baremo documentado suficiente para interpretación automática.",
        evidence_ids: ["ev_prp_total"],
      },
    ],
    instrument_analysis: {
      ipip16: "IPIP-16 muestra niveles descriptivos relativos al rango teórico; no son percentiles.",
      ipip_ipc: "Macroestilo predominante Estable; Influyente aparece segundo. Directivo no se describe como tendencia secundaria.",
      bis11: "BIS-11: 70, clasificación SOBRE_EL_PROMEDIO.",
      prp: "Resultado pendiente de interpretación profesional debido a que no existe definición/baremo documentado suficiente para interpretación automática.",
    },
    integrated_analysis: "Lectura integrada prudente, sin decisión automática.",
    interview_questions: [
      {
        question: "Descríbame una situación durante la conducción en la que tuvo que tomar una decisión rápidamente bajo presión. ¿Qué alternativas consideró y cómo decidió?",
        target: "Toma de decisiones bajo presión.",
        evidence_ids: ["ev_bis11_total"],
      },
      {
        question: "Cuénteme una situación de presión o conflicto durante una jornada laboral. ¿Cómo reaccionó y qué hizo para resolverla?",
        target: "Respuesta conductual ante presión.",
        evidence_ids: ["ev_ipip16_EST"],
      },
      {
        question: "Relate una ocasión en que una instrucción operacional requirió especial atención a normas o procedimientos.",
        target: "Adherencia normativa.",
        evidence_ids: ["ev_ipip16_NOR"],
      },
      {
        question: "Describa una situación en que debió coordinarse con pasajeros, equipo o supervisión.",
        target: "Interacción laboral.",
        evidence_ids: ["ev_ipc_style_estable"],
      },
    ],
    preliminary_conclusion: "Conclusión preliminar no decisoria; requiere contraste profesional.",
    recommendations: [],
    limitations: ["No constituye diagnóstico clínico.", "No constituye decisión automática de contratación o rechazo."],
  };
}

describe("semantic-intensity.test", () => {
  it("clasifica APE 3.14 y NOR 3.00 como intermedios y bloquea escalada", () => {
    expect(classifyIpipTheoreticalLevel(3.14)).toBe("INTERMEDIO_EN_RANGO_TEORICO");
    expect(classifyIpipTheoreticalLevel(3.0)).toBe("INTERMEDIO_EN_RANGO_TEORICO");
    const context = buildPsychSemanticContext(fixturePayload);
    expect(context.evidence_catalog.find((item) => item.id === "ev_ipip16_APE")?.maxAllowedIntensity).toBe("INTERMEDIATE_ONLY");
    const output = validOutput();
    output.strengths[0] = {
      title: "Alta apertura",
      text: "Alta apertura a ideas.",
      evidence_ids: ["ev_ipip16_APE"],
    };
    expect(validatePsychSemanticOutput(output, context).flags).toContain("intensity_escalation_ev_ipip16_APE");
  });
});

describe("bis11-classification-lock.test", () => {
  it("conserva SOBRE_EL_PROMEDIO y rechaza alto/crítico/intervención", () => {
    const context = buildPsychSemanticContext(fixturePayload);
    expect(context.locks.bis11).toMatchObject({ score: 70, classification: "SOBRE_EL_PROMEDIO" });
    const output = validOutput();
    output.points_to_explore[1].text = "BIS-11 muestra impulsividad alta y riesgo crítico que requiere intervención.";
    expect(validatePsychSemanticOutput(output, context).flags).toEqual(
      expect.arrayContaining(["bis11_classification_escalation", "risk_language", "prohibited_semantic_term"]),
    );
  });
});

describe("prp-descriptive-methodology.test", () => {
  it("mantiene PRP como antecedente profesional y bloquea sobrealcances metodológicos", () => {
    const context = buildPsychSemanticContext(fixturePayload);
    expect(context.locks.prp).toMatchObject({
      score: 90,
      interpretation_status: "PROFESSIONAL_ONLY",
      automatic_interpretation_allowed: false,
    });
    const output = validOutput();
    output.points_to_explore[2].text = "PRP se revisa como patrón preventivo descriptivo desde el puntaje total.";
    output.instrument_analysis.prp = "PRP interpreta score total y factores F1-F6 sin nombres de constructos no documentados.";
    expect(validatePsychSemanticOutput(output, context).flags).not.toContain("prp_methodology_overreach");
    output.instrument_analysis.prp = "PRP usa percentil y factor 1 es responsabilidad.";
    expect(validatePsychSemanticOutput(output, context).flags).toContain("prp_methodology_overreach");
  });
});

describe("ipip-theoretical-level.test", () => {
  it("no permite lenguaje de promedio normativo para IPIP sin baremo", () => {
    const context = buildPsychSemanticContext(fixturePayload);
    const output = validOutput();
    output.instrument_analysis.ipip16 = "EST está por debajo del promedio e indica irritabilidad sostenida.";
    expect(validatePsychSemanticOutput(output, context).flags).toContain("prohibited_semantic_term");
  });
});

describe("ipc-macrostyle-consistency.test", () => {
  it("ordena Estable, Influyente, Analítico, Directivo y bloquea Directivo secundario", () => {
    const context = buildPsychSemanticContext(fixturePayload);
    expect(context.locks.ipc?.macrostyles.map((item) => item.label)).toEqual([
      "Estable",
      "Influyente",
      "Analítico",
      "Directivo",
    ]);
    const output = validOutput();
    output.instrument_analysis.ipip_ipc = "Predomina Estable, con Directivo como segunda tendencia.";
    expect(validatePsychSemanticOutput(output, context).flags).toContain("ipc_directive_second_regression");
  });
});

describe("evidence-validation.test", () => {
  it("exige evidence_ids válidos en afirmaciones relevantes", () => {
    const context = buildPsychSemanticContext(fixturePayload);
    const output = validOutput();
    output.points_to_explore[0].evidence_ids = ["ev_inexistente"];
    expect(validatePsychSemanticOutput(output, context).flags).toContain("invalid_evidence_ids");
  });
});

describe("strength-classification.test", () => {
  it("prohíbe recomendaciones metodológicas como fortalezas", () => {
    const context = buildPsychSemanticContext(fixturePayload);
    const output = validOutput();
    output.strengths[0].text = "Mantener revisión profesional y cruzar resultados con entrevista.";
    expect(validatePsychSemanticOutput(output, context).flags).toContain("methodological_strength");
  });
});

describe("interview-neutrality.test", () => {
  it("bloquea preguntas que presuponen defectos", () => {
    const context = buildPsychSemanticContext(fixturePayload);
    const output = validOutput();
    output.interview_questions[0].question = "¿Cuándo tuvo que controlar una impulsividad fuerte mientras conducía?";
    expect(validatePsychSemanticOutput(output, context).flags).toContain("non_neutral_interview_question");
  });
});

describe("risk-language.test", () => {
  it("bloquea lenguaje de riesgo no determinístico", () => {
    const context = buildPsychSemanticContext(fixturePayload);
    const output = validOutput();
    output.preliminary_conclusion = "Presenta alto riesgo e incompatibilidad con el cargo.";
    expect(validatePsychSemanticOutput(output, context).flags).toContain("prohibited_semantic_term");
  });
});

describe("professional-report-language.test", () => {
  it("traduce códigos técnicos antes de persistir informe profesional", () => {
    const output = validOutput();
    output.profile_summary = "BIS-11 SOBRE_EL_PROMEDIO y dimensión INTERMEDIO_EN_RANGO_TEORICO.";
    output.instrument_analysis.bis11 = "Clasificación SOBRE_EL_PROMEDIO.";
    const guarded = validateAndGuardPsychAIOutput(output, fixturePayload);
    expect(JSON.stringify(guarded.output)).not.toContain("SOBRE_EL_PROMEDIO");
    expect(JSON.stringify(guarded.output)).not.toContain("INTERMEDIO_EN_RANGO_TEORICO");
    expect(guarded.output.executive_summary).toContain("sobre el promedio");
  });

  it("permite nota metodológica de no diagnóstico sin convertirla en hard failure", () => {
    const output = validOutput();
    output.limitations = [
      "Los resultados son antecedentes complementarios y no constituyen un diagnóstico clínico ni decisión automática.",
    ];
    const guarded = validateAndGuardPsychAIOutput(output, fixturePayload);
    expect(guarded.guardrailFlags).not.toContain("clinical_word");
    expect(guarded.guardrailFlags).not.toContain("decision_word");
  });

  it("usa flags crudos para revisión sin bloquear si la salida final queda saneada", () => {
    const output = validOutput();
    output.profile_summary = "Diagnóstico preliminar con raw_total y F1 visibles.";
    const guarded = validateAndGuardPsychAIOutput(output, fixturePayload);
    expect(guarded.validationFlags).toContain("clinical_word");
    expect(guarded.validationFlags).toContain("backend_meta_language");
    expect(guarded.validationFlags).toContain("raw_technical_language");
    expect(guarded.guardrailFlags).not.toContain("clinical_word");
    expect(JSON.stringify(guarded.output)).not.toContain("raw_total");
    expect(JSON.stringify(guarded.output)).not.toContain("F1");
  });
});

describe("limitations-dedup.test", () => {
  it("deduplica limitaciones", () => {
    expect(deduplicateLimitations([
      "No constituye diagnóstico clínico.",
      "No constituye diagnóstico clínico.",
      "No constituye decisión automática.",
    ])).toEqual(["No constituye diagnóstico clínico.", "No constituye decisión automática."]);
  });
});

describe("semantic-output-regression.test", () => {
  it("el fallback determinístico no reproduce las regresiones reportadas", () => {
    const output = buildDeterministicPsychSemanticOutput(fixturePayload, "test");
    const text = JSON.stringify(output).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    expect(text).not.toContain("alta apertura");
    expect(text).not.toContain("baja adherencia");
    expect(text).not.toContain("irritabilidad sostenida");
    expect(text).not.toContain("riesgo critico");
    expect(text).not.toContain("requiere intervencion");
    expect(text).toContain("pendiente de interpretacion profesional");
    expect(text).toContain("sobre_el_promedio");
  });
});
