import { createClient } from "https://esm.sh/@supabase/supabase-js@2.108.1";
import { getSupabaseSecretKey } from "../_shared/supabaseKeys.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://gestion.busesjm.cl",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

const redirectTo = "https://gestion.busesjm.cl/reset-password";

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] ?? character);
}

function getClientIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || req.headers.get("x-real-ip")?.trim() || "unknown";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Metodo no permitido" }, 405);

  try {
    const payload = await req.json() as { email?: unknown };
    const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
    if (!email || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonResponse({ accepted: true });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = getSupabaseSecretKey();
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("HIRING_NOTIFICATIONS_FROM_EMAIL");
    if (!supabaseUrl || !resendApiKey || !fromEmail) {
      console.error("password reset broker is not configured");
      return jsonResponse({ error: "Servicio de recuperación no disponible" }, 503);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: allowed, error: limitError } = await adminClient.rpc(
      "claim_password_reset_request",
      { p_email: email, p_ip_address: getClientIp(req) },
    );
    if (limitError) {
      console.error("password reset broker rate-limit check failed");
      return jsonResponse({ error: "Servicio de recuperación no disponible" }, 503);
    }
    if (allowed !== true) return jsonResponse({ accepted: true });

    const { data, error } = await adminClient.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    });
    const actionLink = (data as { properties?: { action_link?: string }; action_link?: string } | null)
      ?.properties?.action_link ?? (data as { action_link?: string } | null)?.action_link;

    // Unknown addresses intentionally produce the same response as accepted requests.
    if (error || !actionLink) return jsonResponse({ accepted: true });

    const safeLink = escapeHtml(actionLink);
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [email],
        subject: "Recupera tu acceso a la Plataforma de Control",
        text: `Solicitaste recuperar tu acceso. Abre este enlace para definir una nueva contraseña: ${actionLink}\n\nSi no realizaste esta solicitud, ignora este correo.`,
        html: `<p>Solicitaste recuperar tu acceso a la Plataforma de Control.</p><p><a href="${safeLink}">Definir nueva contraseña</a></p><p>Si no realizaste esta solicitud, ignora este correo.</p>`,
      }),
    });
    if (!emailResponse.ok) {
      console.error("password reset email provider rejected request", emailResponse.status);
      return jsonResponse({ error: "No fue posible enviar el correo de recuperación" }, 502);
    }

    return jsonResponse({ accepted: true });
  } catch {
    console.error("password reset broker failed");
    return jsonResponse({ error: "No fue posible solicitar la recuperación" }, 500);
  }
});
