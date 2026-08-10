import { useEffect, useState } from "react";

export function useProgressiveBiStage(
  enabled: boolean,
  stageCount: number,
  intervalMs = 180
) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setStage(0);
      return;
    }

    if (stage >= stageCount) {
      return;
    }

    let idleId: number | undefined;
    const timeoutId = window.setTimeout(() => {
      if (typeof window.requestIdleCallback === "function") {
        idleId = window.requestIdleCallback(() => {
          setStage((current) => Math.min(current + 1, stageCount));
        }, { timeout: intervalMs });
        return;
      }

      setStage((current) => Math.min(current + 1, stageCount));
    }, intervalMs);

    return () => {
      window.clearTimeout(timeoutId);
      if (idleId !== undefined && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      }
    };
  }, [enabled, intervalMs, stage, stageCount]);

  return stage;
}
