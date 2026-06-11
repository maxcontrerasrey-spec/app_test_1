import "jsr:@supabase/functions-js/edge-runtime.d.ts";

type Recipient = {
  email: string;
  name?: string | null;
};

type PendingApprovalPayload = {
  kind: "pending_approval";
  event_key: string;
  to: Recipient[];
  approval: {
    id: number;
    step_code: string;
    step_name: string;
    created_at: string | null;
  };
  request: {
    id: string;
    folio: string | number;
    requester_name: string | null;
    requester_email: string | null;
    contract_name: string | null;
    contract_number: string | null;
    job_position_name: string | null;
    cost_center_code: string | null;
    cost_center_name: string | null;
    requested_entry_date: string | null;
    start_date: string | null;
    vacancies: number | null;
  };
  route?: string | null;
};

type RecruitmentHandoffPayload = {
  kind: "recruitment_handoff";
  event_key: string;
  to: Recipient[];
  case: {
    id: string;
    case_code: string | null;
    opened_at: string | null;
    requested_vacancies: number | null;
  };
  request: {
    id: string;
    folio: string | number;
    requester_name: string | null;
    requester_email: string | null;
    contract_name: string | null;
    job_position_name: string | null;
    cost_center_code: string | null;
    cost_center_name: string | null;
    requested_entry_date: string | null;
    start_date: string | null;
  };
  route?: string | null;
};

type EmailPayload = PendingApprovalPayload | RecruitmentHandoffPayload;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function normalizeRecipients(recipients: Recipient[] | undefined): Recipient[] {
  const seen = new Set<string>();
  const normalized: Recipient[] = [];

  for (const recipient of recipients ?? []) {
    const email = recipient?.email?.trim().toLowerCase();
    if (!email || seen.has(email)) {
      continue;
    }

    seen.add(email);
    normalized.push({
      email,
      name: recipient.name?.trim() || null,
    });
  }

  return normalized;
}

function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "No informado";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "medium",
  }).format(parsed);
}

function buildActionUrl(payload: EmailPayload, appBaseUrl: string | null): string | null {
  if (!appBaseUrl) {
    return null;
  }

  const normalizedBase = appBaseUrl.endsWith("/") ? appBaseUrl.slice(0, -1) : appBaseUrl;
  const route = payload.route?.startsWith("/") ? payload.route : `/${payload.route ?? ""}`;

  return `${normalizedBase}${route}`;
}

function buildPendingApprovalEmail(payload: PendingApprovalPayload, actionUrl: string | null) {
  const stepLabel = payload.approval.step_name || payload.approval.step_code;
  const subject = `Pendiente aprobación ${stepLabel}: folio ${payload.request.folio}`;

  const intro = `El folio ${payload.request.folio} quedó pendiente para ${stepLabel}.`;
  const details = [
    ["Solicitante", payload.request.requester_name || payload.request.requester_email || "No informado"],
    ["Contrato", payload.request.contract_name || payload.request.contract_number || "No informado"],
    ["Cargo", payload.request.job_position_name || "No informado"],
    ["Centro de costo", payload.request.cost_center_name || payload.request.cost_center_code || "No informado"],
    ["Vacantes", payload.request.vacancies ?? "No informado"],
    ["Ingreso solicitado", formatDate(payload.request.requested_entry_date)],
    ["Inicio de contrato", formatDate(payload.request.start_date)],
  ];

  const html = `
    <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.5;">
      <h2 style="margin-bottom: 12px;">Aprobación pendiente de contratación</h2>
      <p>${escapeHtml(intro)}</p>
      <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
        <tbody>
          ${details
            .map(
              ([label, value]) => `
                <tr>
                  <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: 600; width: 180px;">${escapeHtml(label)}</td>
                  <td style="padding: 8px; border: 1px solid #cbd5e1;">${escapeHtml(value)}</td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
      ${actionUrl ? `<p><a href="${escapeHtml(actionUrl)}" style="display: inline-block; padding: 10px 14px; background: #0f172a; color: #fff; text-decoration: none; border-radius: 6px;">Abrir bandeja de aprobación</a></p>` : ""}
    </div>
  `;

  const text = [
    intro,
    `Solicitante: ${payload.request.requester_name || payload.request.requester_email || "No informado"}`,
    `Contrato: ${payload.request.contract_name || payload.request.contract_number || "No informado"}`,
    `Cargo: ${payload.request.job_position_name || "No informado"}`,
    `Centro de costo: ${payload.request.cost_center_name || payload.request.cost_center_code || "No informado"}`,
    `Vacantes: ${payload.request.vacancies ?? "No informado"}`,
    `Ingreso solicitado: ${formatDate(payload.request.requested_entry_date)}`,
    `Inicio de contrato: ${formatDate(payload.request.start_date)}`,
    actionUrl ? `Abrir bandeja: ${actionUrl}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return { subject, html, text };
}

function buildRecruitmentHandoffEmail(payload: RecruitmentHandoffPayload, actionUrl: string | null) {
  const subject = `Nuevo folio para reclutamiento: ${payload.case.case_code || `folio ${payload.request.folio}`}`;
  const intro = `El folio ${payload.request.folio} fue aprobado por Control de Contratos y ya quedó disponible para Reclutamiento.`;
  const details = [
    ["Caso", payload.case.case_code || "No informado"],
    ["Solicitante", payload.request.requester_name || payload.request.requester_email || "No informado"],
    ["Contrato", payload.request.contract_name || "No informado"],
    ["Cargo", payload.request.job_position_name || "No informado"],
    ["Centro de costo", payload.request.cost_center_name || payload.request.cost_center_code || "No informado"],
    ["Vacantes", payload.case.requested_vacancies ?? "No informado"],
    ["Ingreso solicitado", formatDate(payload.request.requested_entry_date)],
    ["Inicio de contrato", formatDate(payload.request.start_date)],
  ];

  const html = `
    <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.5;">
      <h2 style="margin-bottom: 12px;">Nuevo caso para Reclutamiento</h2>
      <p>${escapeHtml(intro)}</p>
      <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
        <tbody>
          ${details
            .map(
              ([label, value]) => `
                <tr>
                  <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: 600; width: 180px;">${escapeHtml(label)}</td>
                  <td style="padding: 8px; border: 1px solid #cbd5e1;">${escapeHtml(value)}</td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
      ${actionUrl ? `<p><a href="${escapeHtml(actionUrl)}" style="display: inline-block; padding: 10px 14px; background: #0f172a; color: #fff; text-decoration: none; border-radius: 6px;">Abrir control de contrataciones</a></p>` : ""}
    </div>
  `;

  const text = [
    intro,
    `Caso: ${payload.case.case_code || "No informado"}`,
    `Solicitante: ${payload.request.requester_name || payload.request.requester_email || "No informado"}`,
    `Contrato: ${payload.request.contract_name || "No informado"}`,
    `Cargo: ${payload.request.job_position_name || "No informado"}`,
    `Centro de costo: ${payload.request.cost_center_name || payload.request.cost_center_code || "No informado"}`,
    `Vacantes: ${payload.case.requested_vacancies ?? "No informado"}`,
    `Ingreso solicitado: ${formatDate(payload.request.requested_entry_date)}`,
    `Inicio de contrato: ${formatDate(payload.request.start_date)}`,
    actionUrl ? `Abrir bandeja: ${actionUrl}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return { subject, html, text };
}

function buildEmail(payload: EmailPayload, appBaseUrl: string | null) {
  const actionUrl = buildActionUrl(payload, appBaseUrl);

  if (payload.kind === "pending_approval") {
    return buildPendingApprovalEmail(payload, actionUrl);
  }

  return buildRecruitmentHandoffEmail(payload, actionUrl);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Metodo no permitido" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const webhookSecret = Deno.env.get("INTERNAL_EMAIL_WEBHOOK_SECRET");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("HIRING_NOTIFICATIONS_FROM_EMAIL");
    const appBaseUrl = Deno.env.get("HIRING_NOTIFICATIONS_APP_URL") ?? null;

    if (!webhookSecret) {
      throw new Error("Missing INTERNAL_EMAIL_WEBHOOK_SECRET");
    }

    if (!resendApiKey) {
      throw new Error("Missing RESEND_API_KEY");
    }

    if (!fromEmail) {
      throw new Error("Missing HIRING_NOTIFICATIONS_FROM_EMAIL");
    }

    const providedSecret = req.headers.get("x-internal-webhook-secret");
    if (providedSecret !== webhookSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = (await req.json()) as EmailPayload;
    const recipients = normalizeRecipients(payload.to);

    if (!payload?.kind || (payload.kind !== "pending_approval" && payload.kind !== "recruitment_handoff")) {
      return new Response(JSON.stringify({ error: "Payload invalido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (recipients.length === 0) {
      return new Response(JSON.stringify({ error: "No hay destinatarios validos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const email = buildEmail(payload, appBaseUrl);

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: recipients.map((recipient) => recipient.email),
        subject: email.subject,
        html: email.html,
        text: email.text,
      }),
    });

    const resendBody = await resendResponse.text();
    if (!resendResponse.ok) {
      console.error("Resend error", resendResponse.status, resendBody);
      return new Response(
        JSON.stringify({
          error: "Error enviando correo con Resend",
          details: resendBody,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        event_key: payload.event_key,
        recipients: recipients.map((recipient) => recipient.email),
        provider_response: resendBody,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("transactional email error", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unexpected error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
