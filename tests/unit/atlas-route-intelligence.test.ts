import { describe, expect, it } from "vitest";
import { analyzeValhallaManeuvers, attachValidatedRestrictions, hasValidManeuverLegContext, normalizeClientManeuverFeature, parseRouteAuditOutput, preFilterRouteManeuvers, selectManeuversForAiAudit } from "../../supabase/functions/atlas-tomtom-planning/routeIntelligence.ts";

describe("Atlas Route Intelligence maneuver analyzer", () => {
  it("normaliza los giros cerrados de Valhalla sin fabricar datos viales", () => {
    const maneuvers = analyzeValhallaManeuvers([{ type: 11, instruction: "Gire pronunciadamente a la derecha", bearing_before: 0, bearing_after: 145, begin_shape_index: 1, street_names: ["Avenida Ejemplo"], latitude: -22.4, longitude: -68.9 }]);
    expect(maneuvers[0]).toMatchObject({ maneuverId: "m-001", maneuverType: "RIGHT", turnAngleDeg: 145, roadNames: ["Avenida Ejemplo"], latitude: -22.4, longitude: -68.9 });
    expect(maneuvers[0]?.estimatedRoadWidthM).toBeNull();
    expect(maneuvers[0]?.trafficLevel).toBe("UNKNOWN");
    expect(maneuvers[0]?.knownRestrictionCount).toBeNull();
    expect(preFilterRouteManeuvers(maneuvers)).toEqual([{ maneuverId: "m-001", score: 75, reasons: ["Cambio de rumbo de 145°; requiere revisión operacional."], requiresAiAudit: true }]);
  });

  it("marca U-turn para auditoría, pero no deduce que el vehículo puede o no puede hacerlo", () => {
    const maneuvers = analyzeValhallaManeuvers([{ type: 13, instruction: "Retorno", bearing_before: 20, bearing_after: 200 }]);
    expect(maneuvers[0]?.maneuverType).toBe("UTURN");
    expect(preFilterRouteManeuvers(maneuvers)[0]).toMatchObject({ score: 100, requiresAiAudit: true });
    expect(maneuvers[0]?.estimatedRoadWidthM).toBeNull();
  });

  it("caso crítico: una maniobra casi en U para un bus se eleva a auditoría sin afirmar viabilidad física", () => {
    const turn = analyzeValhallaManeuvers([{ type: 11, instruction: "Giro pronunciado", bearing_before: 4, bearing_after: 178, latitude: -22.45, longitude: -68.93 }]);
    expect(preFilterRouteManeuvers(turn)).toHaveLength(1);
    expect(turn[0]?.estimatedRoadWidthM).toBeNull();
    expect(turn[0]?.trafficLevel).toBe("UNKNOWN");
    expect(turn[0]?.knownRestrictionCount).toBeNull();
  });

  it("solo asocia restricciones Atlas validadas entregadas por el backend y compatibles", () => {
    const turns = analyzeValhallaManeuvers([{ type: 11, instruction: "Gire", latitude: -22.45, longitude: -68.93 }]);
    const restricted = attachValidatedRestrictions(turns, [{
      id: "restriction-1", latitude: -22.4501, longitude: -68.9301, radius_m: 100, maneuver_type: "RIGHT",
      vehicle_type: "BUS", restriction_level: "BLOCKED", reason: "Acceso no permitido a buses", source: "OPERATIONS", valid_from: null, valid_until: null
    }], "BUS");
    expect(restricted[0]?.knownRestrictionCount).toBe(1);
    expect(preFilterRouteManeuvers(restricted)[0]).toMatchObject({ score: 100 });
    expect(attachValidatedRestrictions(turns, [], "BUS")[0]?.knownRestrictionCount).toBe(0);
  });

  it("no eleva una ruta normal a alerta y conserva el ángulo conocido", () => {
    const maneuvers = analyzeValhallaManeuvers([{ type: 8, instruction: "Continúe", bearing_before: 90, bearing_after: 90, street_names: ["Calle A"] }]);
    expect(maneuvers[0]?.turnAngleDeg).toBe(0);
    expect(preFilterRouteManeuvers(maneuvers)).toEqual([]);
  });

  it("acepta el arreglo vacío de restricciones del productor y rechaza restricciones aportadas por el cliente", () => {
    const [feature] = analyzeValhallaManeuvers([{ type: 8, instruction: "Continúe", bearing_before: 90, bearing_after: 90 }]);
    expect(normalizeClientManeuverFeature(feature, 0)?.maneuverId).toBe("m-001");
    expect(normalizeClientManeuverFeature({ ...feature, validatedRestrictions: [{ id: "forged" }] }, 0)).toBeNull();
    expect(normalizeClientManeuverFeature({ ...feature, validatedRestrictions: "[]" }, 0)).toBeNull();
  });

  it("conserva el contexto de tramo y distingue una llegada intermedia de la parada final", () => {
    const route = analyzeValhallaManeuvers([
      { type: 4, instruction: "Llegue al destino", routeLegIndex: 0, legDestinationStopIndex: 1, legDestinationIsFinal: false },
      { type: 4, instruction: "Llegue al destino", routeLegIndex: 1, legDestinationStopIndex: 2, legDestinationIsFinal: true },
    ]);
    const normalized = route.map(normalizeClientManeuverFeature);
    expect(normalized[0]).toMatchObject({ routeLegIndex: 0, legDestinationStopIndex: 1, legDestinationIsFinal: false });
    expect(hasValidManeuverLegContext(normalized.filter((item) => item !== null), 3)).toBe(true);
    expect(hasValidManeuverLegContext(normalized.filter((item) => item !== null), 2)).toBe(false);
    expect(hasValidManeuverLegContext([normalized[0]!], 3)).toBe(false);
  });

  it("envía la ruta al auditor aunque el pre-filtro no encuentre riesgo y distribuye la muestra", () => {
    const route = analyzeValhallaManeuvers(Array.from({ length: 51 }, (_, index) => ({
      type: 8, instruction: `Continúe ${index}`, bearing_before: 90, bearing_after: 90
    })));
    const audited = selectManeuversForAiAudit(route, [], 6);
    expect(audited).toHaveLength(6);
    expect(audited[0]?.maneuverId).toBe("m-001");
    expect(audited.at(-1)?.maneuverId).toBe("m-051");
    expect(new Set(audited.map((item) => item.maneuverId)).size).toBe(6);
  });

  it("prioriza candidatas de riesgo y respeta el límite de costo", () => {
    const route = analyzeValhallaManeuvers(Array.from({ length: 4 }, (_, index) => ({ type: index === 2 ? 13 : 8, instruction: "Siga", bearing_before: 90, bearing_after: 90 })));
    const risks = preFilterRouteManeuvers(route);
    expect(selectManeuversForAiAudit(route, risks, 2).map((item) => item.maneuverId)).toContain("m-003");
  });

  it("valida decisiones estructuradas y rechaza IDs ajenos o REJECT sin evidencia", () => {
    const valid = { decision: "WARNING", riskScore: 73, summary: "Requiere revisión humana.", analyzedManeuvers: [{ maneuverId: "m-001", decision: "CAUTION", riskScore: 73, reasons: ["Giro cerrado"], evidence: ["Valhalla reporta un cambio de rumbo de 145°"], recommendedAction: "HUMAN_REVIEW" }], requiresReplan: false, requiresHumanReview: true };
    expect(parseRouteAuditOutput(valid, new Set(["m-001"]))?.decision).toBe("WARNING");
    expect(parseRouteAuditOutput({ ...valid, decision: "REJECT", analyzedManeuvers: [{ ...valid.analyzedManeuvers[0], decision: "REJECT", evidence: [] }] }, new Set(["m-001"]))).toBeNull();
    expect(parseRouteAuditOutput({ ...valid, analyzedManeuvers: [{ ...valid.analyzedManeuvers[0], maneuverId: "m-999" }] }, new Set(["m-001"]))).toBeNull();
  });
});
