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
  /** Zero-based Valhalla leg metadata; a multi-stop route can have intermediate arrivals. */
  routeLegIndex: number | null;
  legDestinationStopIndex: number | null;
  legDestinationIsFinal: boolean | null;
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
  routeLegIndex?: unknown;
  legDestinationStopIndex?: unknown;
  legDestinationIsFinal?: unknown;
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
      routeLegIndex: Number.isInteger(maneuver.routeLegIndex) && Number(maneuver.routeLegIndex) >= 0 ? Number(maneuver.routeLegIndex) : null,
      legDestinationStopIndex: Number.isInteger(maneuver.legDestinationStopIndex) && Number(maneuver.legDestinationStopIndex) >= 1 ? Number(maneuver.legDestinationStopIndex) : null,
      legDestinationIsFinal: typeof maneuver.legDestinationIsFinal === "boolean" ? maneuver.legDestinationIsFinal : null,
    };
  });
}

function boundedNumber(value: unknown, minimum: number, maximum: number): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum ? value : null;
}

/** Validates the client copy of a Valhalla feature. Restriction records are always reloaded server-side. */
export function normalizeClientManeuverFeature(value: unknown, index: number): RouteManeuverFeature | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const types = new Set<ManeuverType>(["LEFT", "RIGHT", "UTURN", "STRAIGHT", "ROUNDABOUT", "MERGE", "EXIT", "OTHER"]);
  const evidenceAllowlist = new Set(["VALHALLA_MANEUVER_TYPE", "VALHALLA_BEARING_BEFORE_AFTER", "VALHALLA_ROUTE_SHAPE_INDEX", "VALHALLA_STREET_NAMES", "VALHALLA_SHARP_MANEUVER"]);
  const restrictions = row.validatedRestrictions;
  if (row.maneuverId !== `m-${String(index + 1).padStart(3, "0")}` || !types.has(row.maneuverType as ManeuverType) || typeof row.instruction !== "string" || row.instruction.length > 180) return null;
  if (!Array.isArray(row.roadNames) || row.roadNames.length > 4 || row.roadNames.some((item) => typeof item !== "string" || item.length > 100)) return null;
  if (!Array.isArray(row.sourceEvidence) || row.sourceEvidence.length > 5 || row.sourceEvidence.some((item) => typeof item !== "string" || !evidenceAllowlist.has(item))) return null;
  // The producer currently includes an empty placeholder array. Accept it, but never trust client-supplied restrictions.
  if (restrictions !== undefined && (!Array.isArray(restrictions) || restrictions.length > 0)) return null;
  if (row.trafficLevel !== "UNKNOWN" || row.knownRestrictionCount !== null || row.roadClassFrom !== null || row.roadClassTo !== null || row.lanesFrom !== null || row.lanesTo !== null || row.oneWay !== null || row.estimatedRoadWidthM !== null) return null;
  const latitude = row.latitude === null ? null : boundedNumber(row.latitude, -90, 90);
  const longitude = row.longitude === null ? null : boundedNumber(row.longitude, -180, 180);
  const angle = row.turnAngleDeg === null ? null : boundedNumber(row.turnAngleDeg, -180, 180);
  const inbound = row.inboundHeading === null ? null : boundedNumber(row.inboundHeading, 0, 360);
  const outbound = row.outboundHeading === null ? null : boundedNumber(row.outboundHeading, 0, 360);
  const confidence = boundedNumber(row.geometryConfidence, 0, 1);
  const routeLegIndex = row.routeLegIndex === null ? null : boundedNumber(row.routeLegIndex, 0, 149);
  const legDestinationStopIndex = row.legDestinationStopIndex === null ? null : boundedNumber(row.legDestinationStopIndex, 1, 150);
  const legDestinationIsFinal = row.legDestinationIsFinal === null ? null : typeof row.legDestinationIsFinal === "boolean" ? row.legDestinationIsFinal : undefined;
  if ((row.latitude !== null && latitude === null) || (row.longitude !== null && longitude === null) || (row.turnAngleDeg !== null && angle === null) || (row.inboundHeading !== null && inbound === null) || (row.outboundHeading !== null && outbound === null) || confidence === null) return null;
  if ((row.routeLegIndex !== null && (!Number.isInteger(routeLegIndex) || routeLegIndex === null))
    || (row.legDestinationStopIndex !== null && (!Number.isInteger(legDestinationStopIndex) || legDestinationStopIndex === null))
    || legDestinationIsFinal === undefined
    || (routeLegIndex === null) !== (legDestinationStopIndex === null)
    || (routeLegIndex === null) !== (legDestinationIsFinal === null)
    || routeLegIndex !== null && legDestinationStopIndex !== routeLegIndex + 1) return null;
  return {
    maneuverId: row.maneuverId as string, latitude, longitude, maneuverType: row.maneuverType as ManeuverType,
    instruction: row.instruction, roadNames: row.roadNames as string[], turnAngleDeg: angle, inboundHeading: inbound, outboundHeading: outbound,
    roadClassFrom: null, roadClassTo: null, lanesFrom: null, lanesTo: null, oneWay: null, estimatedRoadWidthM: null,
    trafficLevel: "UNKNOWN", knownRestrictionCount: null, validatedRestrictions: [], geometryConfidence: confidence, sourceEvidence: row.sourceEvidence as string[],
    routeLegIndex, legDestinationStopIndex, legDestinationIsFinal
  };
}

/** Confirms each maneuver's leg/destination metadata agrees with the exact ordered stop snapshot. */
export function hasValidManeuverLegContext(maneuvers: RouteManeuverFeature[], stopCount: number) {
  if (!Number.isInteger(stopCount) || stopCount < 2 || maneuvers.length === 0) return false;
  const valid = maneuvers.every((maneuver) =>
    maneuver.routeLegIndex !== null
    && maneuver.legDestinationStopIndex !== null
    && maneuver.legDestinationIsFinal !== null
    && maneuver.routeLegIndex >= 0
    && maneuver.routeLegIndex < stopCount - 1
    && maneuver.legDestinationStopIndex === maneuver.routeLegIndex + 1
    && maneuver.legDestinationStopIndex < stopCount
    && maneuver.legDestinationIsFinal === (maneuver.legDestinationStopIndex === stopCount - 1)
  );
  if (!valid) return false;
  const legsWithEvidence = new Set(maneuvers.map((maneuver) => maneuver.routeLegIndex));
  return Array.from({ length: stopCount - 1 }, (_, index) => index).every((legIndex) => legsWithEvidence.has(legIndex));
}

/** Uses high-risk maneuvers when present; otherwise samples the full route so every route still reaches AI review. */
export function selectManeuversForAiAudit(maneuvers: RouteManeuverFeature[], riskCandidates: ManeuverRiskCandidate[], limit: number): RouteManeuverFeature[] {
  const boundedLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const byId = new Map(maneuvers.map((maneuver) => [maneuver.maneuverId, maneuver]));
  const prioritized = [...riskCandidates]
    .sort((left, right) => right.score - left.score || left.maneuverId.localeCompare(right.maneuverId))
    .slice(0, boundedLimit)
    .map((candidate) => byId.get(candidate.maneuverId))
    .filter((maneuver): maneuver is RouteManeuverFeature => Boolean(maneuver));
  if (prioritized.length) return prioritized;
  if (maneuvers.length <= boundedLimit) return [...maneuvers];
  if (boundedLimit === 1) return [maneuvers[Math.floor((maneuvers.length - 1) / 2)]!];
  const lastIndex = maneuvers.length - 1;
  return Array.from({ length: boundedLimit }, (_, index) => maneuvers[Math.round(index * lastIndex / (boundedLimit - 1))]!);
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

/** Treat incomplete or action-bearing model findings conservatively even if its summary flags disagree. */
export function enforceFailClosedRouteAudit(output: RouteAuditOutput): RouteAuditOutput {
  const hasRejectedManeuver = output.analyzedManeuvers.some((item) => item.decision === "REJECT");
  const hasInsufficientEvidence = output.decision === "INSUFFICIENT_EVIDENCE"
    || output.analyzedManeuvers.some((item) => item.decision === "INSUFFICIENT_EVIDENCE");
  const requiresReplan = output.requiresReplan || hasRejectedManeuver
    || output.analyzedManeuvers.some((item) => item.recommendedAction === "BLOCK_MANEUVER" || item.recommendedAction === "PENALIZE_SEGMENT" || item.recommendedAction === "REQUEST_ALTERNATIVE");
  const requiresHumanReview = output.requiresHumanReview || hasInsufficientEvidence || requiresReplan
    || output.analyzedManeuvers.some((item) => item.recommendedAction === "HUMAN_REVIEW" || item.recommendedAction === "PENALIZE_SEGMENT");
  const decision = hasRejectedManeuver
    ? "REJECT"
    : hasInsufficientEvidence && output.decision === "APPROVE"
    ? "INSUFFICIENT_EVIDENCE"
    : output.decision;
  return { ...output, decision, requiresReplan, requiresHumanReview };
}

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
    if (entry.decision === "REJECT" && evidence.length === 0) return null;
    analyzedManeuvers.push({ maneuverId: entry.maneuverId, decision: entry.decision as RouteAuditOutput["analyzedManeuvers"][number]["decision"], riskScore: score, reasons, evidence, recommendedAction: entry.recommendedAction as RouteAuditOutput["analyzedManeuvers"][number]["recommendedAction"] });
  }
  if (row.decision === "REJECT" && !analyzedManeuvers.some((item) => item.decision === "REJECT" && item.evidence.length > 0)) return null;
  return { decision: row.decision as RouteAuditDecision, riskScore, summary: row.summary.trim(), analyzedManeuvers, requiresReplan: row.requiresReplan, requiresHumanReview: row.requiresHumanReview };
}
