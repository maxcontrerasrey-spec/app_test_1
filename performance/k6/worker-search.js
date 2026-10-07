import http from "k6/http";
import { check } from "k6";
import { Trend } from "k6/metrics";

const rosterCalendarDuration = new Trend("roster_calendar_duration", true);

const productionProjectRef = "pzblmbahnoyntrhistea";
const projectRef = __ENV.PERFORMANCE_STAGING_PROJECT_REF ?? "";
const supabaseUrl = (__ENV.PERFORMANCE_STAGING_SUPABASE_URL ?? "").replace(/\/$/, "");
const syntheticSearchTerm = __ENV.PERFORMANCE_SYNTHETIC_SEARCH_TERM ?? "";
const syntheticDocumentSearchTerm = __ENV.PERFORMANCE_SYNTHETIC_RUT_SEARCH_TERM ?? "";
const datasetScale = __ENV.PERFORMANCE_DATASET_SCALE ?? "";
const confirmedDatasetScale = __ENV.PERFORMANCE_CONFIRMED_DATASET_SCALE ?? "";
const datasetReady = __ENV.PERFORMANCE_SYNTHETIC_DATASET_READY === "true";
const rosterArea = __ENV.PERFORMANCE_SYNTHETIC_ROSTER_AREA ?? "";
const rosterStartDate = __ENV.PERFORMANCE_SYNTHETIC_ROSTER_START_DATE ?? "";
const rosterEndDate = __ENV.PERFORMANCE_SYNTHETIC_ROSTER_END_DATE ?? "";
const requestedVus = Number(__ENV.PERFORMANCE_VUS ?? 0);
const confirmedVus = Number(__ENV.PERFORMANCE_CONFIRMED_VUS ?? 0);
const acceptedVuTiers = [10, 50, 100, 250, 500];

function requireStagingConfiguration() {
  if (__ENV.PERFORMANCE_TARGET_ENV !== "staging") {
    throw new Error("Refusing to run: PERFORMANCE_TARGET_ENV must be exactly 'staging'.");
  }
  if (!projectRef || projectRef === productionProjectRef || !supabaseUrl) {
    throw new Error("Refusing to run: provide a non-production Supabase staging project ref and URL.");
  }

  const parsedUrl = new URL(supabaseUrl);
  if (
    parsedUrl.protocol !== "https:" ||
    parsedUrl.hostname !== `${projectRef}.supabase.co` ||
    !["", "/"].includes(parsedUrl.pathname) ||
    parsedUrl.search !== "" ||
    parsedUrl.hash !== ""
  ) {
    throw new Error("Refusing to run: staging URL must be https://<staging-project-ref>.supabase.co.");
  }
  if (!__ENV.PERFORMANCE_STAGING_ANON_KEY || !__ENV.PERFORMANCE_STAGING_AUTH_JWT) {
    throw new Error("Provide staging-only anon key and authenticated staging JWT in environment variables.");
  }
  if (!syntheticSearchTerm || !syntheticDocumentSearchTerm || !rosterArea) {
    throw new Error("Provide synthetic-only search terms and synthetic operational area; real worker data is prohibited.");
  }
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(rosterStartDate) || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(rosterEndDate)) {
    throw new Error("Provide synthetic roster start and end dates as YYYY-MM-DD.");
  }
  const startTimestamp = Date.parse(`${rosterStartDate}T00:00:00Z`);
  const endTimestamp = Date.parse(`${rosterEndDate}T00:00:00Z`);
  if (
    Number.isNaN(startTimestamp) ||
    Number.isNaN(endTimestamp) ||
    new Date(startTimestamp).toISOString().slice(0, 10) !== rosterStartDate ||
    new Date(endTimestamp).toISOString().slice(0, 10) !== rosterEndDate
  ) {
    throw new Error("Synthetic roster dates must be real calendar dates.");
  }
  const rangeDays = (endTimestamp - startTimestamp) / 86_400_000 + 1;
  if (!Number.isInteger(rangeDays) || rangeDays < 1 || rangeDays > 184) {
    throw new Error("Synthetic roster period must contain between 1 and 184 calendar days.");
  }
  if (!acceptedVuTiers.includes(requestedVus) || requestedVus !== confirmedVus) {
    throw new Error("Choose one VU tier and explicitly confirm the same value; tiers are run separately.");
  }
  if (!(["1x", "10x", "50x"].includes(datasetScale) && datasetScale === confirmedDatasetScale && datasetReady)) {
    throw new Error("Explicitly confirm that the selected synthetic dataset scale is loaded in staging.");
  }
}

requireStagingConfiguration();

const headers = {
  "Content-Type": "application/json",
  apikey: __ENV.PERFORMANCE_STAGING_ANON_KEY,
  Authorization: `Bearer ${__ENV.PERFORMANCE_STAGING_AUTH_JWT}`
};

export const options = {
  scenarios: {
    one_reviewed_load_tier: {
      executor: "constant-vus",
      vus: requestedVus,
      duration: "1m"
    }
  },
  summaryTrendStats: ["avg", "med", "p(95)", "p(99)", "max"],
  thresholds: {
    http_req_failed: ["rate<0.005"],
    "roster_calendar_duration{range_days:31}": ["p(95)<2000"]
  },
  tags: {
    target_env: "staging",
    dataset_scale: datasetScale,
    vus_tier: String(requestedVus)
  }
};

const operations = [
  {
    name: "atlas_ops_search_drivers",
    path: "/rest/v1/rpc/atlas_ops_search_drivers",
    rangeDays: "n/a",
    body: () => ({
      p_search: __ITER % 2 === 0 ? syntheticSearchTerm : syntheticDocumentSearchTerm,
      p_service_date: rosterStartDate,
      p_limit: 12
    })
  },
  {
    name: "search_internal_mobility_workers",
    path: "/rest/v1/rpc/search_internal_mobility_workers",
    rangeDays: "n/a",
    body: () => ({
      p_search: __ITER % 2 === 0 ? syntheticSearchTerm : syntheticDocumentSearchTerm,
      p_limit: 12
    })
  },
  {
    name: "get_internal_mobility_setup_catalogs",
    path: "/rest/v1/rpc/get_internal_mobility_setup_catalogs",
    rangeDays: "n/a",
    body: () => ({})
  },
  {
    name: "roster_calendar",
    rangeDays: String((Date.parse(`${rosterEndDate}T00:00:00Z`) - Date.parse(`${rosterStartDate}T00:00:00Z`)) / 86_400_000 + 1),
  }
];

export default function () {
  const operation = operations[(__VU + __ITER) % operations.length];
  if (operation.name === "roster_calendar") {
    const startedAt = Date.now();
    const requests = [
      {
        method: "POST",
        url: `${supabaseUrl}/rest/v1/rpc/get_hr_roster_calendar_scope_summary_v2`,
        body: JSON.stringify({
          p_start_date: rosterStartDate,
          p_end_date: rosterEndDate,
          p_search: syntheticSearchTerm,
          p_contract_filter: null,
          p_area_filter: rosterArea,
          p_contract_admin_filter: null
        }),
        params: { headers, timeout: "15s", tags: { operation: "roster_summary", range_days: operation.rangeDays } }
      },
      {
        method: "POST",
        url: `${supabaseUrl}/rest/v1/rpc/get_hr_roster_bulk_calendar_page_v2`,
        body: JSON.stringify({
          p_start_date: rosterStartDate,
          p_end_date: rosterEndDate,
          p_search: syntheticSearchTerm,
          p_contract_filter: null,
          p_area_filter: rosterArea,
          p_contract_admin_filter: null,
          p_cycle_filter: null,
          p_page: 1,
          p_page_size: 50,
          p_after_full_name: null,
          p_after_buk_employee_id: null
        }),
        params: { headers, timeout: "15s", tags: { operation: "roster_page", range_days: operation.rangeDays } }
      }
    ];
    const [summaryResponse, pageResponse] = http.batch(requests);
    rosterCalendarDuration.add(Date.now() - startedAt, { range_days: operation.rangeDays, dataset_scale: datasetScale });
    check(summaryResponse, { "roster summary returns HTTP 200": (result) => result.status === 200 });
    check(pageResponse, { "roster page returns HTTP 200": (result) => result.status === 200 });
    return;
  }
  const response = http.post(`${supabaseUrl}${operation.path}`, JSON.stringify(operation.body()), {
    headers,
    timeout: "15s",
    tags: { operation: operation.name, dataset_scale: datasetScale, range_days: operation.rangeDays }
  });

  check(response, {
    [`${operation.name} returns HTTP 200`]: (result) => result.status === 200
  });
}
