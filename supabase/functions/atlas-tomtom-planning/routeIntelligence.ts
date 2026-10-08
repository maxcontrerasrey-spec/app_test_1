export type ManeuverType = "LEFT" | "RIGHT" | "UTURN" | "STRAIGHT" | "ROUNDABOUT" | "MERGE" | "EXIT" | "OTHER";
export type RouteManeuverFeature = {
  maneuverId: string;
  latitude: number | null;
  longitude: number | null;
  maneuverType: ManeuverType;
  instruction: string;
  roadNames: string[];
  turnAngleDeg: number | null;
  inboundHeading: number | null;
  outboundHeading: number | null;
  roadClassFrom: null;
  roadClassTo: null;
  lanesFrom: null;
  lanesTo: null;
  oneWay: null;
  estimatedRoadWidthM: null;
  trafficLevel: "UNKNOWN";
  knownRestrictionCount: number | null;
  validatedRestrictions: Array<{ id: string; level: "INFO" | "CAUTION" | "BLOCKED"; reason: string; source: string }>;
  geometryConfidence: number;
  sourceEvidence: string[];
};

export type RawValhallaManeuver = {
  type?: unknown;
  instruction?: unknown;
  begin_shape_index?: unknown;
  bearing_before?: unknown;
  bearing_after?: unknown;
  street_names?: unknown;
  latitude?: unknown;
  longitude?: unknown;
};

export type ManeuverRiskCandidate = { maneuverId: string; score: number; reasons: string[]; requiresAiAudit: boolean };
export type ValidatedRouteRestriction = {
  id: string; latitude: number; longitude: number; radius_m: number; maneuver_type: ManeuverType | null;
  vehicle_type: string | null; restriction_level: "INFO" | "CAUTION" | "BLOCKED"; reason: string; source: string;
  valid_from: string | null; valid_until: string | null;
};

export const ROUTE_RISK_RULES = {
  version: "1.0.0",
  severeAngleDegrees: 135,
  highRiskScore: 70,
  severeManeuverScore: 75,
  uTurnScore: 100,
  moderateAngleDegrees: 110,
  moderateManeuverScore: 55,
} as const;

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizedHeading(value: unknown): number | null {
  const heading = finiteNumber(value);
  return heading === null || heading < 0 || heading > 360 ? null : heading;
}

function angleBetween(inbound: number | null, outbound: number | null): number | null {
  if (inbound === null || outbound === null) return null;
  const clockwise = (outbound - inbound + 360) % 360;
  return Math.round(clockwise > 180 ? clockwise - 360 : clockwise);
}

function maneuverType(type: unknown): ManeuverType {
  if (type === 12 || type === 13) return "UTURN";
  if (type === 9 || type === 10 || type === 11) return "RIGHT";
  if (type === 14 || type === 15 || type === 16) return "LEFT";
  if (type === 22) return "MERGE";
  if (type === 20 || type === 21) return "EXIT";
  if (type === 23 || type === 24 || type === 25 || type === 26) return "ROUNDABOUT";
  if (type === 7 || type === 8 || type === 17) return "STRAIGHT";
  return "OTHER";
}

/** Normalizes only facts available in Valhalla's maneuver response. Missing facts remain null/UNKNOWN. */
export function analyzeValhallaManeuvers(maneuvers: RawValhallaManeuver[]): RouteManeuverFeature[] {
  return maneuvers.slice(0, 500).map((maneuver, index) => {
    const inboundHeading = normalizedHeading(maneuver.bearing_before);
    const outboundHeading = normalizedHeading(maneuver.bearing_after);
    const latitude = finiteNumber(maneuver.latitude);
    const longitude = finiteNumber(maneuver.longitude);
    const roadNames = Array.isArray(maneuver.street_names)
      ? maneuver.street_names.filter((name): name is string => typeof name === "string").map((name) => name.slice(0, 100)).slice(0, 4)
      : [];
    const sourceEvidence = ["VALHALLA_MANEUVER_TYPE"];
    if (inboundHeading !== null && outboundHeading !== null) sourceEvidence.push("VALHALLA_BEARING_BEFORE_AFTER");
    if (latitude !== null && longitude !== null) sourceEvidence.push("VALHALLA_ROUTE_SHAPE_INDEX");
    if (roadNames.length) sourceEvidence.push("VALHALLA_STREET_NAMES");
    if (maneuver.type === 11 || maneuver.type === 14) sourceEvidence.push("VALHALLA_SHARP_MANEUVER");
    const geometryEvidenceItems = [inboundHeading !== null && outboundHeading !== null, latitude !== null && longitude !== null, typeof maneuver.type === "number"].filter(Boolean).length;
    // Coverage of three geometric input fields, not a probability that the turn is safe.
    const geometryConfidence = Number((geometryEvidenceItems / 3).toFixed(2));
    return {
      maneuverId: `m-${String(index + 1).padStart(3, "0")}`,
      latitude,
      longitude,
      maneuverType: maneuverType(maneuver.type),
      instruction: typeof maneuver.instruction === "string" ? maneuver.instruction.slice(0, 180) : "",
      roadNames,
      turnAngleDeg: angleBetween(inboundHeading, outboundHeading),
      inboundHeading,
      outboundHeading,
      roadClassFrom: null,
      roadClassTo: null,
      lanesFrom: null,
      lanesTo: null,
      oneWay: null,
      estimatedRoadWidthM: null,
      trafficLevel: "UNKNOWN",
      knownRestrictionCount: null,
      validatedRestrictions: [],
      geometryConfidence,
      sourceEvidence,
    };
  });
}

/** Deterministic triage only. A candidate is a prompt for review, never proof of physical infeasibility. */
function distanceMeters(latitudeA: number, longitudeA: number, latitudeB: number, longitudeB: number) {
  const toRadians = Math.PI / 180;
  const latitudeDelta = (latitudeB - latitudeA) * toRadians;
  const longitudeDelta = (longitudeB - longitudeA) * toRadians;
  const meanLatitude = (latitudeA + latitudeB) * toRadians / 2;
  return Math.hypot(latitudeDelta, longitudeDelta * Math.cos(meanLatitude)) * 6_371_000;
}

/** Attaches only human-validated, currently effective operational knowledge to nearby maneuvers. */
export function attachValidatedRestrictions(maneuvers: RouteManeuverFeature[], restrictions: ValidatedRouteRestriction[], vehicleType: string | null, now = Date.now()): RouteManeuverFeature[] {
  return maneuvers.map((maneuver) => {
    if (maneuver.latitude === null || maneuver.longitude === null) return maneuver;
    const matches = restrictions.filter((restriction) => {
      if (restriction.vehicle_type && restriction.vehicle_type !== vehicleType) return false;
      if (restriction.maneuver_type && restriction.maneuver_type !== maneuver.maneuverType) return false;
      if (restriction.valid_from && Date.parse(restriction.valid_from) > now) return false;
      if (restriction.valid_until && Date.parse(restriction.valid_until) <= now) return false;
      return distanceMeters(maneuver.latitude!, maneuver.longitude!, restriction.latitude, restriction.longitude) <= restriction.radius_m;
    }).slice(0, 10);
    return { ...maneuver, knownRestrictionCount: matches.length, validatedRestrictions: matches.map(({ id, restriction_level, reason, source }) => ({ id, level: restriction_level, reason: reason.slice(0, 500), source })) };
  });
}

export function preFilterRouteManeuvers(maneuvers: RouteManeuverFeature[]): ManeuverRiskCandidate[] {
  return maneuvers.flatMap((maneuver) => {
    const reasons: string[] = [];
    let score = 0;
    if (maneuver.maneuverType === "UTURN") {
      score = ROUTE_RISK_RULES.uTurnScore;
      reasons.push("Valhalla identifica una maniobra de retorno en U.");
    }
    if (maneuver.validatedRestrictions.some((restriction) => restriction.level === "BLOCKED")) {
      score = Math.max(score, 100);
      reasons.push("Existe una restricción operacional validada de bloqueo cerca de esta maniobra.");
    } else if (maneuver.validatedRestrictions.some((restriction) => restriction.level === "CAUTION")) {
      score = Math.max(score, ROUTE_RISK_RULES.severeManeuverScore);
      reasons.push("Existe una restricción operacional validada que requiere cautela.");
    } else if (maneuver.validatedRestrictions.length) {
      score = Math.max(score, ROUTE_RISK_RULES.moderateManeuverScore);
      reasons.push("Hay información operacional validada cerca de la maniobra.");
    }
    if (maneuver.turnAngleDeg !== null && Math.abs(maneuver.turnAngleDeg) >= ROUTE_RISK_RULES.severeAngleDegrees) {
      score = Math.max(score, ROUTE_RISK_RULES.severeManeuverScore);
      reasons.push(`Cambio de rumbo de ${Math.abs(maneuver.turnAngleDeg)}°; requiere revisión operacional.`);
    } else if (maneuver.turnAngleDeg !== null && Math.abs(maneuver.turnAngleDeg) >= ROUTE_RISK_RULES.moderateAngleDegrees) {
      score = Math.max(score, ROUTE_RISK_RULES.moderateManeuverScore);
      reasons.push(`Cambio de rumbo de ${Math.abs(maneuver.turnAngleDeg)}°; revisar contexto de la intersección.`);
    } else if (maneuver.maneuverType === "LEFT" || maneuver.maneuverType === "RIGHT") {
      // Valhalla's sharp-left/right types are 14 and 11 respectively.
      const sharp = maneuver.sourceEvidence.includes("VALHALLA_SHARP_MANEUVER");
      if (sharp) {
        score = Math.max(score, ROUTE_RISK_RULES.severeManeuverScore);
        reasons.push("Valhalla clasifica el giro como cerrado.");
      }
    }
    if (score < ROUTE_RISK_RULES.highRiskScore) return [];
    return [{ maneuverId: maneuver.maneuverId, score, reasons, requiresAiAudit: true }];
  });
}

export type RouteAuditDecision = "APPROVE" | "WARNING" | "REJECT" | "INSUFFICIENT_EVIDENCE" | "ERROR";
export type ManeuverAuditDecision = "OK" | "CAUTION" | "REJECT" | "INSUFFICIENT_EVIDENCE";
export type RouteAuditOutput = {
  decision: RouteAuditDecision;
  riskScore: number | null;
  summary: string;
  analyzedManeuvers: Array<{
    maneuverId: string;
    decision: ManeuverAuditDecision;
    riskScore: number;
    reasons: string[];
    evidence: string[];
    recommendedAction: "NONE" | "WARN" | "BLOCK_MANEUVER" | "PENALIZE_SEGMENT" | "REQUEST_ALTERNATIVE" | "HUMAN_REVIEW";
  }>;
  requiresReplan: boolean;
  requiresHumanReview: boolean;
};

const routeDecisions = new Set<RouteAuditDecision>(["APPROVE", "WARNING", "REJECT", "INSUFFICIENT_EVIDENCE"]);
const maneuverDecisions = new Set<ManeuverAuditDecision>(["OK", "CAUTION", "REJECT", "INSUFFICIENT_EVIDENCE"]);
const actions = new Set<RouteAuditOutput["analyzedManeuvers"][number]["recommendedAction"]>(["NONE", "WARN", "BLOCK_MANEUVER", "PENALIZE_SEGMENT", "REQUEST_ALTERNATIVE", "HUMAN_REVIEW"]);

function boundedStringArray(value: unknown, maxItems: number): string[] | null {
  if (!Array.isArray(value) || value.length > maxItems || value.some((item) => typeof item !== "string" || item.length > 300)) return null;
  return value.map((item) => (item as string).trim()).filter(Boolean);
}

/** Validates the model output and prevents it from referring to maneuvers outside this candidate. */
export function parseRouteAuditOutput(value: unknown, allowedManeuverIds: Set<string>): RouteAuditOutput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const riskScore = finiteNumber(row.riskScore);
  if (!routeDecisions.has(row.decision as RouteAuditDecision) || riskScore === null || riskScore < 0 || riskScore > 100 || typeof row.summary !== "string" || row.summary.length > 1200 || !Array.isArray(row.analyzedManeuvers) || row.analyzedManeuvers.length > 100 || typeof row.requiresReplan !== "boolean" || typeof row.requiresHumanReview !== "boolean") return null;
  const analyzedManeuvers: RouteAuditOutput["analyzedManeuvers"] = [];
  for (const item of row.analyzedManeuvers) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const entry = item as Record<string, unknown>;
    const score = finiteNumber(entry.riskScore);
    const reasons = boundedStringArray(entry.reasons, 8);
    const evidence = boundedStringArray(entry.evidence, 8);
    if (typeof entry.maneuverId !== "string" || !allowedManeuverIds.has(entry.maneuverId) || !maneuverDecisions.has(entry.decision as ManeuverAuditDecision) || score === null || score < 0 || score > 100 || !reasons || !evidence || !actions.has(entry.recommendedAction as RouteAuditOutput["analyzedManeuvers"][number]["recommendedAction"])) return null;
    analyzedManeuvers.push({ maneuverId: entry.maneuverId, decision: entry.decision as RouteAuditOutput["analyzedManeuvers"][number]["decision"], riskScore: score, reasons, evidence, recommendedAction: entry.recommendedAction as RouteAuditOutput["analyzedManeuvers"][number]["recommendedAction"] });
  }
  if (row.decision === "REJECT" && !analyzedManeuvers.some((item) => item.decision === "REJECT" && item.evidence.length > 0)) return null;
  return { decision: row.decision as RouteAuditDecision, riskScore, summary: row.summary.trim(), analyzedManeuvers, requiresReplan: row.requiresReplan, requiresHumanReview: row.requiresHumanReview };
}
