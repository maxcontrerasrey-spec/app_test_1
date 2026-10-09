import { describe, expect, it, vi } from "vitest";
import {
  mergeBukSyncStatusSnapshots,
  reconcileBukSyncJobs,
  type BukSyncStatusSnapshot
} from "../../src/modules/recruitment/services/bukSyncReconciliation";

type Snapshot = BukSyncStatusSnapshot & { candidate: string };

const immediateOptions = {
  maxAttempts: 3,
  delayForAttempt: () => 0,
  sleep: async () => undefined
};

describe("BUK sync reconciliation", () => {
  it("waits for a job claimed by cron and returns its canonical success", async () => {
    const fetchStatuses = vi
      .fn<() => Promise<{ data: Snapshot[]; error: string | null }>>()
      .mockResolvedValueOnce({
        data: [{ job_id: "job-1", status: "processing", candidate: "candidate-1" }],
        error: null
      })
      .mockResolvedValueOnce({
        data: [{ job_id: "job-1", status: "success", candidate: "candidate-1" }],
        error: null
      });

    const result = await reconcileBukSyncJobs(["job-1"], fetchStatuses, immediateOptions);

    expect(result).toMatchObject({ error: null, timedOut: false });
    expect(result.data).toEqual([
      { job_id: "job-1", status: "success", candidate: "candidate-1" }
    ]);
    expect(fetchStatuses).toHaveBeenCalledTimes(2);
  });

  it("recovers a terminal result even when the browser dispatch produced no row", async () => {
    const fetchStatuses = vi.fn().mockResolvedValue({
      data: [{ job_id: "job-2", status: "success", candidate: "candidate-2" }],
      error: null
    });

    const result = await reconcileBukSyncJobs(["job-2"], fetchStatuses, immediateOptions);

    expect(result.timedOut).toBe(false);
    expect(result.data[0]?.status).toBe("success");
  });

  it("keeps mixed terminal results without duplicates", async () => {
    const fetchStatuses = vi.fn().mockResolvedValue({
      data: [
        { job_id: "job-3", status: "success", candidate: "candidate-3" },
        { job_id: "job-4", status: "error", candidate: "candidate-4" }
      ],
      error: null
    });

    const result = await reconcileBukSyncJobs(
      ["job-3", "job-4", "job-3"],
      fetchStatuses,
      immediateOptions
    );

    expect(result.timedOut).toBe(false);
    expect(result.data).toHaveLength(2);
    expect(fetchStatuses).toHaveBeenCalledWith(["job-3", "job-4"]);
  });

  it("reports a real timeout as still processing instead of zero confirmations", async () => {
    const fetchStatuses = vi.fn().mockResolvedValue({
      data: [{ job_id: "job-5", status: "processing", candidate: "candidate-5" }],
      error: null
    });

    const result = await reconcileBukSyncJobs(["job-5"], fetchStatuses, {
      ...immediateOptions,
      maxAttempts: 2
    });

    expect(result).toMatchObject({ error: null, timedOut: true });
    expect(result.data[0]?.status).toBe("processing");
    expect(fetchStatuses).toHaveBeenCalledTimes(3);
  });

  it("replaces stale snapshots with the latest state", () => {
    expect(
      mergeBukSyncStatusSnapshots(
        [{ job_id: "job-6", status: "processing", candidate: "candidate-6" }],
        [{ job_id: "job-6", status: "success", candidate: "candidate-6" }]
      )
    ).toEqual([{ job_id: "job-6", status: "success", candidate: "candidate-6" }]);
  });
});
