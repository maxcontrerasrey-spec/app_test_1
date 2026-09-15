import { describe, expect, it } from "vitest";
import { isWorkerLookupSearchReady } from "../../src/shared/ui/forms/WorkerLookupField";

describe("worker lookup search readiness", () => {
  it("allows names from two characters", () => {
    expect(isWorkerLookupSearchReady("ma")).toBe(true);
    expect(isWorkerLookupSearchReady(" m ")).toBe(false);
  });

  it("requires four digits for numeric and formatted RUT searches", () => {
    expect(isWorkerLookupSearchReady("12")).toBe(false);
    expect(isWorkerLookupSearchReady("12.3")).toBe(false);
    expect(isWorkerLookupSearchReady("12.34")).toBe(true);
    expect(isWorkerLookupSearchReady("1234-K")).toBe(true);
  });
});
