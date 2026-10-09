export type StopAccessCandidate = {
  stopIndex: number;
};

export type PedestrianVerifiedCandidate<T extends StopAccessCandidate> = T & {
  pedestrianAccessMeters: number;
};

/** Keeps a stop move only when Valhalla maps a short pedestrian connection to it. */
export async function verifyPedestrianStopAccess<T extends StopAccessCandidate>(
  candidates: T[],
  measureAccessMeters: (candidate: T) => Promise<number | null>,
  retraceAccessibleStops: (stopIndexes: ReadonlySet<number>) => Promise<T[]>,
  maxWalkMeters = 30
): Promise<PedestrianVerifiedCandidate<T>[] | null> {
  if (!candidates.length || !Number.isFinite(maxWalkMeters) || maxWalkMeters < 0) return null;

  const measure = async (items: T[]) => Promise.all(items.map(async (candidate) => ({
    candidate,
    distanceMeters: await measureAccessMeters(candidate)
  })));
  const isReachable = (distance: number | null): distance is number =>
    typeof distance === "number" && Number.isFinite(distance) && distance >= 0 && distance <= maxWalkMeters;
  const firstMeasurements = await measure(candidates);
  if (firstMeasurements.every(({ distanceMeters }) => isReachable(distanceMeters))) {
    return firstMeasurements.map(({ candidate, distanceMeters }) => ({
      ...candidate,
      pedestrianAccessMeters: distanceMeters as number
    }));
  }

  const reachableIndexes = new Set(firstMeasurements
    .filter(({ distanceMeters }) => isReachable(distanceMeters))
    .map(({ candidate }) => candidate.stopIndex));
  if (!reachableIndexes.size) return null;

  const retracedCandidates = await retraceAccessibleStops(reachableIndexes);
  if (!retracedCandidates.length || retracedCandidates.some(({ stopIndex }) => !reachableIndexes.has(stopIndex))) return null;
  const retracedMeasurements = await measure(retracedCandidates);
  if (retracedMeasurements.some(({ distanceMeters }) => !isReachable(distanceMeters))) return null;

  return retracedMeasurements.map(({ candidate, distanceMeters }) => ({
    ...candidate,
    pedestrianAccessMeters: distanceMeters as number
  }));
}
