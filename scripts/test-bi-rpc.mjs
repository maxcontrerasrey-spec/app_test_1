import { createClient } from '@supabase/supabase-js';
import { readEnvFile, requireEnv } from './lib/env.mjs';

const env = { ...readEnvFile(), ...process.env };
const supabaseUrl = requireEnv(
  env.VITE_SUPABASE_URL ?? env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL ?? null,
  "Missing Supabase URL"
);
const serviceRoleKey = requireEnv(env.SUPABASE_SERVICE_ROLE_KEY ?? null, "SUPABASE_SERVICE_ROLE_KEY");

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function test() {
  const { data, error } = await supabase.rpc("get_bi_workforce_overview", {
    p_period_code: null,
    p_contract_codes: null,
    p_job_titles: null
  });
  console.log("Data overview:", data);
  if (error) console.error("Error overview:", error);

  const res2 = await supabase.rpc("get_bi_headcount_by_contract", {
    p_period_code: null,
    p_contract_codes: null,
    p_job_titles: null
  });
  console.log("Data contract:", res2.data?.length);
  if (res2.error) console.error("Error contract:", res2.error);
}

test();
