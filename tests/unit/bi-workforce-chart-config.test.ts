import { describe, expect, it } from "vitest";
import {
  buildIncorporationPaceSeries,
  isFutureBucketDate
} from "../../src/modules/bi/lib/recruitmentAnalyticsChartConfig";
import {
  buildAbsenteeismByContractRows,
  computeAbsenteeismTrendDelta,
  computePresenceSummary,
  mergeAbsenteeismTrend,
  buildRecentPeriodCodes,
  WORKFORCE_PALETTE
} from "../../src/modules/bi/lib/workforceChartConfig";
import type { BukBiExceptionsMonthly } from "../../src/modules/bi/types";

function monthlyRow(
  overrides: Partial<BukBiExceptionsMonthly> & Pick<BukBiExceptionsMonthly, "contractCode" | "exceptionType">
): BukBiExceptionsMonthly {
  return {
    monthStart: "2026-08-01",
    yearMonth: "202608",
    exceptionSource: "buk",
    totalDays: 0,
    uniqueEmployees: 0,
    fteHeadcountEquivalent: 0,
    headcountBase: 0,
    absenteeismPct: 0,
    ...overrides
  };
}

describe("mergeAbsenteeismTrend", () => {
  it("combina el ausentismo entre contratos en vez de tomar una fila arbitraria", () => {
    // El RPC repite el mismo absenteeism_pct por contrato en cada fila de
    // tipo de excepción. Tomar una sola fila ignoraría al resto de los
    // contratos filtrados; el porcentaje debe derivarse de las sumas.
    const rows = new Map<string, BukBiExceptionsMonthly[]>([
      [
        "202608",
        [
          monthlyRow({
            contractCode: "A",
            exceptionType: "vacation",
            totalDays: 30,
            fteHeadcountEquivalent: 90,
            headcountBase: 100,
            absenteeismPct: 10
          }),
          monthlyRow({
            contractCode: "A",
            exceptionType: "medical_leave",
            totalDays: 10,
            fteHeadcountEquivalent: 90,
            headcountBase: 100,
            absenteeismPct: 10
          }),
          monthlyRow({
            contractCode: "B",
            exceptionType: "vacation",
            totalDays: 60,
            fteHeadcountEquivalent: 150,
            headcountBase: 300,
            absenteeismPct: 50
          })
        ]
      ]
    ]);

    const [point] = mergeAbsenteeismTrend(["202608"], rows);

    expect(point.vacationDays).toBe(90);
    expect(point.medicalLeaveDays).toBe(10);
    expect(point.totalDays).toBe(100);
    // (1 - (90 + 150) / (100 + 300)) * 100 = 40, no 10 ni 50 ni su promedio.
    expect(point.absenteeismPct).toBeCloseTo(40, 6);
    expect(point.hasData).toBe(true);
  });

  it("distingue un mes resuelto sin ausencias de un mes sin datos", () => {
    const rows = new Map<string, BukBiExceptionsMonthly[]>([["202607", []]]);

    const [resolved, missing] = mergeAbsenteeismTrend(["202607", "202608"], rows);

    // Resuelto sin filas: cero real.
    expect(resolved.hasData).toBe(true);
    expect(resolved.vacationDays).toBe(0);

    // Clave ausente: hueco, nunca cero inventado.
    expect(missing.hasData).toBe(false);
    expect(missing.vacationDays).toBeNull();
    expect(missing.medicalLeaveDays).toBeNull();
    expect(missing.otherAbsenceDays).toBeNull();
    expect(missing.absenteeismPct).toBeNull();
  });

  it("deja el porcentaje en null cuando no hay dotación base", () => {
    const rows = new Map<string, BukBiExceptionsMonthly[]>([
      ["202608", [monthlyRow({ contractCode: "A", exceptionType: "vacation", totalDays: 5 })]]
    ]);

    expect(mergeAbsenteeismTrend(["202608"], rows)[0].absenteeismPct).toBeNull();
  });
});

describe("computeAbsenteeismTrendDelta", () => {
  const point = (periodCode: string, absenteeismPct: number | null, hasData = true) => ({
    periodCode,
    monthLabel: periodCode,
    vacationDays: 0,
    medicalLeaveDays: 0,
    otherAbsenceDays: 0,
    totalDays: 0,
    absenteeismPct,
    hasData
  });

  it("compara en puntos porcentuales, no en variación relativa", () => {
    const delta = computeAbsenteeismTrendDelta([point("202607", 2), point("202608", 4)]);

    // De 2% a 4% son +2 pp (no +100%).
    expect(delta?.deltaPp).toBeCloseTo(2, 6);
    expect(delta?.currentPct).toBe(4);
    expect(delta?.previousPct).toBe(2);
  });

  it("ignora los meses sin datos al elegir el mes de comparación", () => {
    const delta = computeAbsenteeismTrendDelta([
      point("202606", 5),
      point("202607", null, false),
      point("202608", 8)
    ]);

    // Debe comparar contra junio (último mes con dato), no contra el hueco.
    expect(delta?.previousLabel).toBe("202606");
    expect(delta?.deltaPp).toBeCloseTo(3, 6);
  });

  it("no informa delta si no hay al menos dos meses con dato", () => {
    expect(computeAbsenteeismTrendDelta([point("202608", 4)])).toBeNull();
    expect(computeAbsenteeismTrendDelta([point("202608", null, false)])).toBeNull();
  });
});

describe("computePresenceSummary", () => {
  it("no cuenta dos veces a quien tiene varias excepciones el mismo día", () => {
    // Escenario: 100 personas, 30 con vacaciones y 10 con licencia médica,
    // de las cuales 5 tienen ambas activas el mismo día.
    // get_bi_presence_summary_today deduplica con count(distinct) y reporta
    // 35 ausentes / 65 presentes. Sumar los conteos por tipo del overview
    // (30 + 10) daría 40 ausentes: 5 personas contadas dos veces.
    const summary = computePresenceSummary([
      { contractCode: "A", headcount: 100, absentToday: 35, presentToday: 65, presencePct: 65 }
    ]);

    expect(summary?.totalAbsent).toBe(35);
    expect(summary?.totalPresent).toBe(65);
    expect(summary?.presencePct).toBeCloseTo(65, 6);
    expect(summary?.absenteeismPct).toBeCloseTo(35, 6);
  });

  it("agrega entre contratos y mantiene presencia y ausentismo complementarios", () => {
    const summary = computePresenceSummary([
      { contractCode: "A", headcount: 200, absentToday: 20, presentToday: 180, presencePct: 90 },
      { contractCode: "B", headcount: 300, absentToday: 30, presentToday: 270, presencePct: 90 }
    ]);

    expect(summary?.totalHeadcount).toBe(500);
    expect(summary?.totalPresent).toBe(450);
    expect(summary?.totalAbsent).toBe(50);
    // El invariante que garantiza que KPI y anillo nunca se contradigan.
    expect((summary?.presencePct ?? 0) + (summary?.absenteeismPct ?? 0)).toBeCloseTo(100, 6);
  });

  it("devuelve null sin filas y evita dividir por cero sin dotación", () => {
    expect(computePresenceSummary([])).toBeNull();

    const empty = computePresenceSummary([
      { contractCode: "A", headcount: 0, absentToday: 0, presentToday: 0, presencePct: 0 }
    ]);
    expect(empty?.presencePct).toBe(0);
    expect(empty?.absenteeismPct).toBe(0);
  });
});

describe("buildAbsenteeismByContractRows", () => {
  it("resuelve el nombre del contrato y ordena por mayor ausentismo", () => {
    const rows = buildAbsenteeismByContractRows(
      [
        { contractCode: "183", headcount: 214, absentToday: 18, presentToday: 196, presencePct: 91.6 },
        { contractCode: "305", headcount: 98, absentToday: 22, presentToday: 76, presencePct: 77.6 },
        { contractCode: "999", headcount: 10, absentToday: 1, presentToday: 9, presencePct: 90 },
        { contractCode: "410", headcount: 0, absentToday: 0, presentToday: 0, presencePct: 0 }
      ],
      new Map([
        ["183", "SERVICIO CODELCO DMH"],
        ["305", "MINERA ESCONDIDA"]
      ])
    );

    // Contratos sin dotación se excluyen (100% de ausentismo falso).
    expect(rows).toHaveLength(3);
    // Orden por ausentismo desc: 305 (22,4%) > 999 (10%) > 183 (8,4%).
    expect(rows.map((row) => row.label)).toEqual([
      "MINERA ESCONDIDA",
      // Sin nombre conocido se cae al código, nunca se oculta la fila.
      "999",
      "SERVICIO CODELCO DMH"
    ]);
    expect(rows[0].absenteeismPct).toBeCloseTo(22.4, 6);
  });
});

describe("buildIncorporationPaceSeries", () => {
  const timelineDay = (bucketStart: string, hiredCandidates: number, executedMobilities: number) => ({
    bucketStart,
    bucketLabel: bucketStart,
    openedFolios: 0,
    readyCandidates: 0,
    hiredCandidates,
    executedMobilities,
    requestedVacancies: 0
  });

  it("excluye buckets futuros en vez de dibujarlos como cero", () => {
    const reference = new Date(2026, 7, 15);
    const series = buildIncorporationPaceSeries(
      [
        timelineDay("2026-08-14", 2, 1),
        timelineDay("2026-08-15", 3, 0),
        timelineDay("2026-08-16", 0, 0),
        timelineDay("2026-08-31", 0, 0)
      ],
      "daily",
      reference
    );

    expect(series).toHaveLength(2);
    expect(isFutureBucketDate("2026-08-16", reference)).toBe(true);
    expect(isFutureBucketDate("2026-08-15", reference)).toBe(false);
  });

  it("suma contrataciones y movilidad ejecutada como incorporaciones", () => {
    const series = buildIncorporationPaceSeries(
      [timelineDay("2026-08-10", 7, 3)],
      "daily",
      new Date(2026, 7, 15)
    );

    expect(series[0].hiredCandidates).toBe(7);
    expect(series[0].executedMobilities).toBe(3);
    expect(series[0].totalIncorporations).toBe(10);
  });
});

describe("buildRecentPeriodCodes", () => {
  it("entrega los últimos períodos YYYYMM cruzando el cambio de año", () => {
    expect(buildRecentPeriodCodes(3, new Date(2026, 0, 15))).toEqual(["202511", "202512", "202601"]);
  });
});

describe("WORKFORCE_PALETTE", () => {
  it("distingue la serie de tasa de los tipos de ausencia en todos los temas", () => {
    (["light", "dark", "e-ink"] as const).forEach((mode) => {
      const palette = WORKFORCE_PALETTE[mode];
      expect(palette.absenteeismRate).not.toBe(palette.vacation);
      expect(palette.absenteeismRate).not.toBe(palette.medicalLeave);
      expect(palette.absenteeismRate).not.toBe(palette.otherAbsence);
    });
  });
});
