import { supabase } from "../lib/supabase";

export type StorageHealth = {
  storage: "r2";
  connected: boolean;
  writable: false;
  existing_supabase_storage_untouched: true;
};

export async function checkR2Connection(): Promise<StorageHealth> {
  if (!supabase) {
    throw new Error("Supabase no está configurado.");
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;

  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    throw new Error("La sesión actual no está autenticada.");
  }

  const response = await fetch("/api/storage/health", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    throw new Error(`No se pudo validar R2 (${response.status}).`);
  }

  return (await response.json()) as StorageHealth;
}
