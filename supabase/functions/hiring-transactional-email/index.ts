import "jsr:@supabase/functions-js/edge-runtime.d.ts";

type Recipient = {
  email: string;
  name?: string | null;
};

type PendingApprovalPayload = {
  kind: "pending_approval";
  event_key: string;
  is_reminder?: boolean;
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
    request_context?: "hiring" | "internal_mobility" | null;
    module_label?: string | null;
    requester_name: string | null;
    requester_email: string | null;
    employee_name?: string | null;
    contract_name: string | null;
    contract_number: string | null;
    job_position_name: string | null;
    cost_center_code: string | null;
    cost_center_name: string | null;
    requested_entry_date: string | null;
    start_date: string | null;
    vacancies: number | null;
    current_company_name?: string | null;
    destination_company_name?: string | null;
    requires_termination?: boolean | null;
    motive?: string | null;
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
    request_context?: "hiring" | "internal_mobility" | null;
    module_label?: string | null;
    requester_name: string | null;
    requester_email: string | null;
    employee_name?: string | null;
    contract_name: string | null;
    job_position_name: string | null;
    cost_center_code: string | null;
    cost_center_name: string | null;
    requested_entry_date: string | null;
    start_date: string | null;
    current_company_name?: string | null;
    destination_company_name?: string | null;
    requires_termination?: boolean | null;
    motive?: string | null;
  };
  route?: string | null;
};

type WhoApprovalPayload = {
  kind: "who_approval";
  event_key: string;
  is_reminder?: boolean;
  to: Recipient[];
  approval: {
    id: number;
    stage_code: string;
    created_at: string | null;
  };
  candidate: {
    id: string;
    full_name: string | null;
    rut: string | null;
  };
  request: {
    id: string;
    folio: string | number;
    requester_name: string | null;
    requester_email: string | null;
    job_position_name: string | null;
    contract_name: string | null;
  };
  route?: string | null;
};

type RejectionPayload = {
  kind: "rejection";
  event_key: string;
  to: Recipient[];
  approval: {
    id: number;
    step_name: string;
    comments: string | null;
  };
  request: {
    id: string;
    folio: string | number;
    request_context?: "hiring" | "internal_mobility" | null;
    module_label?: string | null;
    requester_name: string | null;
    requester_email: string | null;
    contract_name: string | null;
    job_position_name: string | null;
  };
  route?: string | null;
};

type PersonnelToHirePayload = {
  kind: "personnel_to_hire";
  event_key: string;
  is_reminder?: boolean;
  to: Recipient[];
  candidate: {
    id: string;
    full_name: string | null;
    rut: string | null;
    ready_for_hire_at: string | null;
  };
  case: {
    id: string;
    case_code: string | null;
  };
  request: {
    id: string;
    folio: string | number;
    request_context?: "hiring" | "internal_mobility" | null;
    module_label?: string | null;
    requester_name: string | null;
    requester_email: string | null;
    contract_name: string | null;
    job_position_name: string | null;
    cost_center_code: string | null;
    cost_center_name: string | null;
    requested_entry_date: string | null;
    owner_name?: string | null;
  };
  route?: string | null;
};

type EmailPayload =
  | PendingApprovalPayload
  | RecruitmentHandoffPayload
  | WhoApprovalPayload
  | RejectionPayload
  | PersonnelToHirePayload;

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

function buildEmailLayout(
  title: string,
  intro: string,
  details: Array<[string, string | number | null | undefined]>,
  actionUrl: string | null,
  actionText: string,
  isError: boolean = false
): string {
  const titleColor = isError ? "#ef4444" : "#0f172a";
  return `
    <div style="background-color: #f8fafc; padding: 40px 20px; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1); border: 1px solid #e2e8f0;">
        <div style="padding: 32px;">
          <h2 style="margin: 0 0 16px; font-size: 20px; color: ${titleColor}; font-weight: 600;">${escapeHtml(title)}</h2>
          <p style="margin: 0 0 24px; font-size: 15px; color: #475569; line-height: 1.6;">${escapeHtml(intro)}</p>

          <div style="background-color: #f8fafc; border-radius: 8px; padding: 16px; margin-bottom: 24px; border: 1px solid #e2e8f0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tbody>
                ${details
                  .map(
                    ([label, value]) => `
                      <tr>
                        <td style="padding: 8px 0; color: #64748b; font-size: 14px; width: 40%; vertical-align: top;">${escapeHtml(label)}</td>
                        <td style="padding: 8px 0; color: #0f172a; font-size: 14px; font-weight: 500; vertical-align: top;">${escapeHtml(value)}</td>
                      </tr>
                    `
                  )
                  .join("")}
              </tbody>
            </table>
          </div>

          ${actionUrl ? `
            <div style="margin-top: 32px; text-align: center;">
              <a href="${escapeHtml(actionUrl)}" style="display: inline-block; padding: 12px 24px; background-color: #0f172a; color: #ffffff; text-decoration: none; font-weight: 500; font-size: 14px; border-radius: 6px;">${escapeHtml(actionText)}</a>
            </div>
          ` : ""}
        </div>

        <div style="background-color: #f1f5f9; padding: 24px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
          <p style="margin: 0 0 8px; font-size: 13px; color: #64748b;">Este correo es de generación automática y no se debe responder.</p>
          <p style="margin: 0; font-size: 13px; color: #64748b; font-weight: 500;">Equipo de Excelencia Operacional</p>
        </div>
      </div>
    </div>
  `.trim();
}

function buildPendingApprovalEmail(payload: PendingApprovalPayload, actionUrl: string | null) {
  const stepLabel = payload.approval.step_name || payload.approval.step_code;
  const isInternalMobility = payload.request.request_context === "internal_mobility";
  const subjectPrefix = payload.is_reminder ? "RECORDATORIO: Pendiente aprobación" : "Pendiente aprobación";
  const subject = isInternalMobility
    ? `${subjectPrefix} ${payload.request.module_label || "Movilidad Interna"}: folio ${payload.request.folio}`
    : `${subjectPrefix} ${stepLabel}: folio ${payload.request.folio}`;

  const introPrefix = payload.is_reminder ? "Este es un recordatorio de que la" : "La";
  const introPrefixEl = payload.is_reminder ? "Este es un recordatorio de que el" : "El";
  const introSuffix = payload.is_reminder ? "sigue pendiente" : "quedó pendiente";
  const intro = isInternalMobility
    ? `${introPrefix} solicitud ${payload.request.folio} de movilidad interna ${introSuffix} para ${stepLabel}.`
    : `${introPrefixEl} folio ${payload.request.folio} ${introSuffix} para ${stepLabel}.`;
  const details = isInternalMobility
    ? [
        ["Solicitante", payload.request.requester_name || payload.request.requester_email || "No informado"],
        ["Trabajador", payload.request.employee_name || "No informado"],
        ["Cargo destino", payload.request.job_position_name || "No informado"],
        ["Área destino", payload.request.contract_name || "No informado"],
        ["Empresa actual", payload.request.current_company_name || "No informado"],
        ["Empresa destino", payload.request.destination_company_name || "No informado"],
        ["Requiere finiquito", payload.request.requires_termination ? "Sí" : "No"],
        ["Motivo", payload.request.motive || "No informado"],
      ]
    : [
        ["Solicitante", payload.request.requester_name || payload.request.requester_email || "No informado"],
        ["Contrato", payload.request.contract_name || payload.request.contract_number || "No informado"],
        ["Cargo", payload.request.job_position_name || "No informado"],
        ["Centro de costo", payload.request.cost_center_name || payload.request.cost_center_code || "No informado"],
        ["Vacantes", payload.request.vacancies ?? "No informado"],
        ["Ingreso solicitado", formatDate(payload.request.requested_entry_date)],
        ["Inicio de contrato", formatDate(payload.request.start_date)],
      ];

  const html = buildEmailLayout(
    `${payload.is_reminder ? "Recordatorio: " : ""}${isInternalMobility ? "Aprobación pendiente de movilidad interna" : "Aprobación pendiente de contratación"}`,
    intro,
    details,
    actionUrl,
    "Abrir bandeja de aprobación"
  );

  const text = [
    intro,
    ...(isInternalMobility
      ? [
          `Solicitante: ${payload.request.requester_name || payload.request.requester_email || "No informado"}`,
          `Trabajador: ${payload.request.employee_name || "No informado"}`,
          `Cargo destino: ${payload.request.job_position_name || "No informado"}`,
          `Área destino: ${payload.request.contract_name || "No informado"}`,
          `Empresa actual: ${payload.request.current_company_name || "No informado"}`,
          `Empresa destino: ${payload.request.destination_company_name || "No informado"}`,
          `Requiere finiquito: ${payload.request.requires_termination ? "Sí" : "No"}`,
          `Motivo: ${payload.request.motive || "No informado"}`,
        ]
      : [
          `Solicitante: ${payload.request.requester_name || payload.request.requester_email || "No informado"}`,
          `Contrato: ${payload.request.contract_name || payload.request.contract_number || "No informado"}`,
          `Cargo: ${payload.request.job_position_name || "No informado"}`,
          `Centro de costo: ${payload.request.cost_center_name || payload.request.cost_center_code || "No informado"}`,
          `Vacantes: ${payload.request.vacancies ?? "No informado"}`,
          `Ingreso solicitado: ${formatDate(payload.request.requested_entry_date)}`,
          `Inicio de contrato: ${formatDate(payload.request.start_date)}`,
        ]),
    actionUrl ? `Abrir bandeja: ${actionUrl}` : null,
    "",
    "---",
    "Este correo es de generación automática y no se debe responder.",
    "Atte.,",
    "Equipo de Excelencia Operacional"
  ]
    .filter(Boolean)
    .join("\n");

  return { subject, html, text };
}

function buildWhoApprovalEmail(payload: WhoApprovalPayload, actionUrl: string | null) {
  const subjectPrefix = payload.is_reminder ? "RECORDATORIO: Pendiente evaluación" : "Pendiente evaluación";
  const subject = `${subjectPrefix} antecedentes: candidato ${payload.candidate.full_name || payload.candidate.rut || "No informado"}`;

  const introPrefix = payload.is_reminder ? "Este es un recordatorio de que el" : "El";
  const introSuffix = payload.is_reminder ? "sigue pendiente" : "quedó pendiente";
  const intro = `${introPrefix} candidato ${payload.candidate.full_name || payload.candidate.rut || "No informado"} ${introSuffix} de evaluación de antecedentes (WHO).`;

  const details = [
    ["Candidato", payload.candidate.full_name || "No informado"],
    ["RUT", payload.candidate.rut || "No informado"],
    ["Folio origen", payload.request.folio],
    ["Solicitante", payload.request.requester_name || payload.request.requester_email || "No informado"],
    ["Cargo al que postula", payload.request.job_position_name || "No informado"],
    ["Área destino", payload.request.contract_name || "No informado"],
  ];

  const html = buildEmailLayout(
    `${payload.is_reminder ? "Recordatorio: " : ""}Evaluación de Antecedentes (WHO)`,
    intro,
    details,
    actionUrl,
    "Abrir control de contrataciones"
  );

  const text = [
    intro,
    ...details.map(([label, value]) => `${label}: ${value}`),
    actionUrl ? `Abrir bandeja: ${actionUrl}` : null,
    "",
    "---",
    "Este correo es de generación automática y no se debe responder.",
    "Atte.,",
    "Equipo de Excelencia Operacional"
  ]
    .filter(Boolean)
    .join("\n");

  return { subject, html, text };
}

function buildRejectionEmail(payload: RejectionPayload, actionUrl: string | null) {
  const isInternalMobility = payload.request.request_context === "internal_mobility";
  const moduleLabel = payload.request.module_label || (isInternalMobility ? "Movilidad Interna" : "Contratación");
  const subject = `Rechazo solicitud de ${moduleLabel}: folio ${payload.request.folio}`;

  const intro = isInternalMobility
    ? `Lamentamos informarte que la solicitud ${payload.request.folio} de movilidad interna fue rechazada en la etapa "${payload.approval.step_name}".`
    : `Lamentamos informarte que el folio ${payload.request.folio} fue rechazado en la etapa "${payload.approval.step_name}".`;

  const details = [
    ["Folio", payload.request.folio],
    ["Etapa de rechazo", payload.approval.step_name],
    ["Motivo/Comentario", payload.approval.comments || "Sin comentarios adicionales"],
    ["Cargo", payload.request.job_position_name || "No informado"],
    ["Área destino", payload.request.contract_name || "No informado"],
  ];

  const html = buildEmailLayout(
    "Solicitud rechazada",
    intro,
    details,
    actionUrl,
    "Ver detalle",
    true
  );

  const text = [
    intro,
    ...details.map(([label, value]) => `${label}: ${value}`),
    actionUrl ? `Ver detalle: ${actionUrl}` : null,
    "",
    "---",
    "Este correo es de generación automática y no se debe responder.",
    "Atte.,",
    "Equipo de Excelencia Operacional"
  ]
    .filter(Boolean)
    .join("\n");

  return { subject, html, text };
}

function buildPersonnelToHireEmail(payload: PersonnelToHirePayload, actionUrl: string | null) {
  const subjectPrefix = payload.is_reminder
    ? "RECORDATORIO: Pendiente generación en BUK"
    : "Nuevo candidato listo para generar en BUK";
  const subject = `${subjectPrefix}: ${payload.candidate.full_name || payload.candidate.rut || "No informado"}`;

  const intro = payload.is_reminder
    ? `El candidato ${payload.candidate.full_name || payload.candidate.rut || "No informado"} sigue pendiente de generación en BUK desde su ingreso a Personal a Contratar.`
    : `El candidato ${payload.candidate.full_name || payload.candidate.rut || "No informado"} ingresó a Personal a Contratar y quedó disponible para gestión administrativa en BUK.`;

  const details = [
    ["Candidato", payload.candidate.full_name || "No informado"],
    ["RUT", payload.candidate.rut || "No informado"],
    ["Folio", payload.request.folio],
    ["Caso", payload.case.case_code || "No informado"],
    ["Solicitante", payload.request.requester_name || payload.request.requester_email || "No informado"],
    ["Contrato", payload.request.contract_name || "No informado"],
    ["Cargo", payload.request.job_position_name || "No informado"],
    ["Centro de costo", payload.request.cost_center_name || payload.request.cost_center_code || "No informado"],
    ["Listo para contratar desde", formatDate(payload.candidate.ready_for_hire_at)],
    ["Ingreso solicitado", formatDate(payload.request.requested_entry_date)],
    ["Owner", payload.request.owner_name || "No informado"],
  ];

  const html = buildEmailLayout(
    `${payload.is_reminder ? "Recordatorio: " : ""}Personal a Contratar pendiente de BUK`,
    intro,
    details,
    actionUrl,
    "Abrir Personal a Contratar"
  );

  const text = [
    intro,
    ...details.map(([label, value]) => `${label}: ${value}`),
    actionUrl ? `Abrir bandeja: ${actionUrl}` : null,
    "",
    "---",
    "Este correo es de generación automática y no se debe responder.",
    "Atte.,",
    "Equipo de Excelencia Operacional"
  ]
    .filter(Boolean)
    .join("\n");

  return { subject, html, text };
}

function buildRecruitmentHandoffEmail(payload: RecruitmentHandoffPayload, actionUrl: string | null) {
  const isInternalMobility = payload.request.request_context === "internal_mobility";
  const subject = isInternalMobility
    ? `Nueva solicitud aprobada para ${payload.request.module_label || "Movilidad Interna"}: ${payload.request.folio}`
    : `Nuevo folio para reclutamiento: ${payload.case.case_code || `folio ${payload.request.folio}`}`;
  const intro = isInternalMobility
    ? `La solicitud ${payload.request.folio} de movilidad interna fue aprobada por Control de Contratos y ya quedó disponible para Reclutamiento.`
    : `El folio ${payload.request.folio} fue aprobado por Control de Contratos y ya quedó disponible para Reclutamiento.`;
  const details = isInternalMobility
    ? [
        ["Folio", payload.request.folio],
        ["Solicitante", payload.request.requester_name || payload.request.requester_email || "No informado"],
        ["Trabajador", payload.request.employee_name || "No informado"],
        ["Cargo destino", payload.request.job_position_name || "No informado"],
        ["Área destino", payload.request.contract_name || "No informado"],
        ["Empresa actual", payload.request.current_company_name || "No informado"],
        ["Empresa destino", payload.request.destination_company_name || "No informado"],
        ["Requiere finiquito", payload.request.requires_termination ? "Sí" : "No"],
      ]
    : [
        ["Caso", payload.case.case_code || "No informado"],
        ["Solicitante", payload.request.requester_name || payload.request.requester_email || "No informado"],
        ["Contrato", payload.request.contract_name || "No informado"],
        ["Cargo", payload.request.job_position_name || "No informado"],
        ["Centro de costo", payload.request.cost_center_name || payload.request.cost_center_code || "No informado"],
        ["Vacantes", payload.case.requested_vacancies ?? "No informado"],
        ["Ingreso solicitado", formatDate(payload.request.requested_entry_date)],
        ["Inicio de contrato", formatDate(payload.request.start_date)],
      ];

  const html = buildEmailLayout(
    isInternalMobility ? "Nuevo caso de movilidad interna para Reclutamiento" : "Nuevo caso para Reclutamiento",
    intro,
    details,
    actionUrl,
    "Abrir control de contrataciones"
  );

  const text = [
    intro,
    ...(isInternalMobility
      ? [
          `Folio: ${payload.request.folio}`,
          `Solicitante: ${payload.request.requester_name || payload.request.requester_email || "No informado"}`,
          `Trabajador: ${payload.request.employee_name || "No informado"}`,
          `Cargo destino: ${payload.request.job_position_name || "No informado"}`,
          `Área destino: ${payload.request.contract_name || "No informado"}`,
          `Empresa actual: ${payload.request.current_company_name || "No informado"}`,
          `Empresa destino: ${payload.request.destination_company_name || "No informado"}`,
          `Requiere finiquito: ${payload.request.requires_termination ? "Sí" : "No"}`,
        ]
      : [
          `Caso: ${payload.case.case_code || "No informado"}`,
          `Solicitante: ${payload.request.requester_name || payload.request.requester_email || "No informado"}`,
          `Contrato: ${payload.request.contract_name || "No informado"}`,
          `Cargo: ${payload.request.job_position_name || "No informado"}`,
          `Centro de costo: ${payload.request.cost_center_name || payload.request.cost_center_code || "No informado"}`,
          `Vacantes: ${payload.case.requested_vacancies ?? "No informado"}`,
          `Ingreso solicitado: ${formatDate(payload.request.requested_entry_date)}`,
          `Inicio de contrato: ${formatDate(payload.request.start_date)}`,
        ]),
    actionUrl ? `Abrir bandeja: ${actionUrl}` : null,
    "",
    "---",
    "Este correo es de generación automática y no se debe responder.",
    "Atte.,",
    "Equipo de Excelencia Operacional"
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

  if (payload.kind === "who_approval") {
    return buildWhoApprovalEmail(payload, actionUrl);
  }

  if (payload.kind === "rejection") {
    return buildRejectionEmail(payload, actionUrl);
  }

  if (payload.kind === "personnel_to_hire") {
    return buildPersonnelToHireEmail(payload, actionUrl);
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

    if (
      !payload?.kind ||
      (
        payload.kind !== "pending_approval" &&
        payload.kind !== "recruitment_handoff" &&
        payload.kind !== "who_approval" &&
        payload.kind !== "rejection" &&
        payload.kind !== "personnel_to_hire"
      )
    ) {
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
