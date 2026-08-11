import { buildPublicAppUrl } from "../../../shared/config/runtime";
import { supabase } from "../../../shared/lib/supabase";
import { normalizeAuthOperationError } from "../lib/authErrors";

function buildResetPasswordRedirectUrl() {
  return buildPublicAppUrl("/reset-password");
}

export async function signInWithPassword(email: string, password: string) {
  if (!supabase) {
    return {
      error: normalizeAuthOperationError("Supabase no está configurado en este entorno.")
    };
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  return { error: normalizeAuthOperationError(error) };
}

export async function fetchEffectivePermissions() {
  if (!supabase) {
    return { data: null, error: "Supabase no está configurado en este entorno." };
  }

  const { data, error } = await supabase.rpc("get_my_effective_permissions");
  return { data: data ?? null, error: error ?? null };
}

export async function fetchSharedLoginOperatorOptions() {
  if (!supabase) {
    return { data: null, error: "Supabase no está configurado en este entorno." };
  }

  const { data, error } = await supabase.rpc("get_shared_login_operator_options");
  return { data: data ?? null, error: error ?? null };
}

export async function selectSharedLoginOperator(params: {
  operatorChoiceId: string;
  appSessionId: string | null;
  userAgent: string | null;
}) {
  if (!supabase) {
    return { data: null, error: "Supabase no está configurado en este entorno." };
  }

  const { data, error } = await supabase.rpc("select_shared_login_operator", {
    p_operator_choice_id: params.operatorChoiceId,
    p_app_session_id: params.appSessionId,
    p_user_agent: params.userAgent
  });

  return { data: data ?? null, error: error ?? null };
}

export async function sendPasswordResetEmail(email: string) {
  if (!supabase) {
    return {
      error: normalizeAuthOperationError("Supabase no está configurado en este entorno.")
    };
  }

  const { error } = await supabase.functions.invoke("request-password-reset", {
    body: {
      email,
      redirectTo: buildResetPasswordRedirectUrl()
    }
  });

  return { error: normalizeAuthOperationError(error) };
}

export async function updateCurrentUserPassword(password: string) {
  if (!supabase) {
    return { error: "Supabase no está configurado en este entorno." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  return { error: error?.message ?? null };
}

export async function acceptAupPolicyForCurrentUser() {
  if (!supabase) {
    return { data: null, error: "Supabase no está configurado en este entorno." };
  }

  const { data, error } = await supabase.rpc("accept_aup_policy", {
    p_ip_address: null
  });

  return { data: data ?? null, error: error ?? null };
}
