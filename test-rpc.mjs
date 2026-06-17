import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase.rpc("get_bi_workforce_overview", {
    p_period_code: null,
    p_contract_codes: null,
    p_job_titles: null
  });
  console.log("Data:", data);
  if (error) console.error("Error:", error);
}

test();
