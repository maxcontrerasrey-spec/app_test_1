const RETRYABLE_HTTP_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

function parseRetryAfter(response, now = Date.now()) {
  const value = response.headers.get("retry-after")?.trim();
  if (!value) return null;

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;

  const retryAt = Date.parse(value);
  return Number.isFinite(retryAt) ? Math.max(0, retryAt - now) : null;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchBukWithRetry(
  url,
  options,
  {
    retries = 5,
    baseDelayMs = 1000,
    maxDelayMs = 15000,
    fetchImpl = fetch,
    sleep = wait,
    random = Math.random,
  } = {},
) {
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    let response;
    try {
      response = await fetchImpl(url, options);
    } catch (error) {
      if (error?.name === "AbortError" || attempt === retries) throw error;
      lastError = error;
      const backoff = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      await sleep(Math.round(backoff * (0.8 + random() * 0.4)));
      continue;
    }

    if (response.ok) return response;

    lastError = new Error(`BUK request failed with status ${response.status}.`);
    if (!RETRYABLE_HTTP_STATUSES.has(response.status) || attempt === retries) {
      throw lastError;
    }

    const backoff = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
    const retryAfter = parseRetryAfter(response);
    const delay = Math.min(maxDelayMs, retryAfter ?? Math.round(backoff * (0.8 + random() * 0.4)));
    await sleep(delay);
  }

  throw lastError instanceof Error ? lastError : new Error("BUK request failed.");
}
