export type BukSyncTerminalStatus = "success" | "error";
export type BukSyncActiveStatus = "pending" | "processing";
export type BukSyncJobStatus = BukSyncTerminalStatus | BukSyncActiveStatus;

export type BukSyncStatusSnapshot = {
  job_id: string;
  status: BukSyncJobStatus;
};

type StatusFetchResult<TStatus extends BukSyncStatusSnapshot> = {
  data: TStatus[];
  error: string | null;
};

type ReconciliationOptions = {
  maxAttempts?: number;
  delayForAttempt?: (attempt: number) => number;
  sleep?: (milliseconds: number) => Promise<void>;
};

const DEFAULT_MAX_ATTEMPTS = 22;

export function isBukSyncTerminal(status: BukSyncJobStatus | string) {
  return status === "success" || status === "error";
}

export function mergeBukSyncStatusSnapshots<TStatus extends BukSyncStatusSnapshot>(
  current: TStatus[],
  incoming: TStatus[]
) {
  const byJobId = new Map(current.map((row) => [row.job_id, row]));
  for (const row of incoming) {
    byJobId.set(row.job_id, row);
  }
  return Array.from(byJobId.values());
}

function defaultDelayForAttempt(attempt: number) {
  return attempt < 5 ? 1_500 : 5_000;
}

function defaultSleep(milliseconds: number) {
  return new Promise<void>((resolve) => globalThis.setTimeout(resolve, milliseconds));
}

export async function reconcileBukSyncJobs<TStatus extends BukSyncStatusSnapshot>(
  jobIds: string[],
  fetchStatuses: (jobIds: string[]) => Promise<StatusFetchResult<TStatus>>,
  options: ReconciliationOptions = {}
) {
  const normalizedJobIds = Array.from(new Set(jobIds.map((jobId) => jobId.trim()).filter(Boolean)));
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const delayForAttempt = options.delayForAttempt ?? defaultDelayForAttempt;
  const sleep = options.sleep ?? defaultSleep;
  let latest: TStatus[] = [];

  if (normalizedJobIds.length === 0) {
    return { data: latest, error: null, timedOut: false };
  }

  for (let attempt = 0; attempt <= maxAttempts; attempt += 1) {
    if (attempt > 0) {
      await sleep(delayForAttempt(attempt - 1));
    }

    const result = await fetchStatuses(normalizedJobIds);
    if (result.error) {
      return { data: latest, error: result.error, timedOut: false };
    }

    latest = mergeBukSyncStatusSnapshots(latest, result.data);
    const statusByJobId = new Map(latest.map((row) => [row.job_id, row.status]));
    if (
      normalizedJobIds.every((jobId) => {
        const status = statusByJobId.get(jobId);
        return status ? isBukSyncTerminal(status) : false;
      })
    ) {
      return { data: latest, error: null, timedOut: false };
    }
  }

  return { data: latest, error: null, timedOut: true };
}
