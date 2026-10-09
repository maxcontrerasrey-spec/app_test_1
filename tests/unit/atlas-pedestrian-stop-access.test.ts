import { describe, expect, it, vi } from "vitest";
import { verifyPedestrianStopAccess } from "../../supabase/functions/atlas-tomtom-planning/pedestrianStopAccess";

type Candidate = { stopIndex: number; label: string; adjustedLng: number };

describe("Atlas pedestrian access validation", () => {
  it("keeps a short mapped crossing and retraces without an unreachable side-of-street stop", async () => {
    const reachableSide: Candidate = { stopIndex: 1, label: "Parada vereda norte", adjustedLng: -68.93 };
    const unreachableSide: Candidate = { stopIndex: 2, label: "Parada sin cruce peatonal", adjustedLng: -68.9301 };
    const retrace = vi.fn(async (indexes: ReadonlySet<number>) => {
      expect([...indexes]).toEqual([1]);
      return [reachableSide];
    });
    const measure = vi.fn(async (candidate: Candidate) => candidate.stopIndex === 1 ? 9 : null);

    const verified = await verifyPedestrianStopAccess(
      [reachableSide, unreachableSide],
      measure,
      retrace
    );

    expect(retrace).toHaveBeenCalledTimes(1);
    expect(measure).toHaveBeenCalledTimes(3);
    expect(verified).toEqual([{ ...reachableSide, pedestrianAccessMeters: 9 }]);
  });

  it("does not adjust a stop when the crossing has no mapped pedestrian path", async () => {
    const candidate: Candidate = { stopIndex: 3, label: "Parada sin acceso", adjustedLng: -68.93 };
    const retrace = vi.fn(async () => [candidate]);

    const verified = await verifyPedestrianStopAccess([candidate], async () => null, retrace);

    expect(verified).toBeNull();
    expect(retrace).not.toHaveBeenCalled();
  });

  it("rejects a retraced stop if its pedestrian connection exceeds 30 meters", async () => {
    const candidate: Candidate = { stopIndex: 4, label: "Parada cruzada", adjustedLng: -68.93 };
    const unreachable: Candidate = { stopIndex: 5, label: "Parada sin conexión", adjustedLng: -68.9301 };
    const measure = vi.fn()
      .mockResolvedValueOnce(12)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(31);

    const verified = await verifyPedestrianStopAccess([candidate, unreachable], measure, async () => [candidate]);

    expect(verified).toBeNull();
    expect(measure).toHaveBeenCalledTimes(3);
  });
});
