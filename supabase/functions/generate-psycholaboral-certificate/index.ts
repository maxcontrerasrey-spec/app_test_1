import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.108.1";
import {
  PDFDocument,
  type PDFFont,
  type PDFImage,
  type PDFPage,
  rgb,
  StandardFonts,
} from "npm:pdf-lib@1.17.1";
import { getSupabaseSecretKey } from "../_shared/supabaseKeys.ts";
import {
  CONSORCIO_ANDINO_LOGO_BASE64,
  CONSORCIO_NUEVO_NORTE_LOGO_BASE64,
  JM_LOGO_BASE64,
} from "../generate-competency-certificate/logos.ts";

const BUCKET = "psychometric_documents";
const corsHeaders = {
  "Access-Control-Allow-Origin": "https://gestion.busesjm.cl",
  "Content-Type": "application/json",
};

type Payload = {
  assessment_id: string;
  public_id: string;
  completed_at: string;
  candidate: {
    full_name: string;
    national_id: string;
    job_position_name: string;
    contract_name: string;
    case_code: string;
    company_name: string;
  };
  instruments: Array<{
    code: string;
    name: string;
    result: Record<string, unknown>;
    response_count: number;
    response_summary: Array<{ label: string; count: number }>;
    result_sha256: string;
  }>;
  consents: Array<
    {
      code: string;
      version: string;
      document_sha256: string;
      accepted_at: string;
    }
  >;
};

function bytesFromBase64(value: string) {
  const data = value.includes(",") ? value.split(",").at(-1) ?? "" : value;
  return Uint8Array.from(atob(data), (char) => char.charCodeAt(0));
}

async function sha256(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", copy.buffer);
  return Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) <= maxWidth) line = test;
    else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function namedScores(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  return Object.values(value as Record<string, unknown>)
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return "";
      const score = item as Record<string, unknown>;
      return `${String(score.name ?? "Dimensión")}: ${String(score.mean ?? score.score ?? "-")}`;
    })
    .filter(Boolean)
    .join(" · ");
}

function formatResult(result: Record<string, unknown>) {
  if (result.kind === "barratt") {
    return `Puntaje total: ${result.total}. Clasificación: ${result.classification}.`;
  }
  if (result.kind === "ipc32") {
    return `Ejes continuos - Calidez: ${result.warmth}; Dominancia: ${result.dominance}. Octantes: ${namedScores(result.octants)}`;
  }
  if (result.kind === "ipip16") {
    return `Dimensiones (media 1-5): ${namedScores(result.dimensions)}. Sin baremo chileno; requiere revisión profesional.`;
  }
  if (result.kind === "prp") {
    const factors = result.factors && typeof result.factors === "object"
      ? Object.entries(result.factors as Record<string, unknown>)
        .map(([name, score]) => `${name}: ${String(score)}`)
        .join(" · ")
      : "";
    return `Puntaje directo: ${result.raw_total}. Factores: ${factors || "sin factores calculables"}. Baremos: revisión profesional pendiente.`;
  }
  return "Resultados disponibles para revisión profesional en el ERP.";
}

function normalizeCompanyName(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function resolveLogo(companyName: string) {
  const normalized = normalizeCompanyName(companyName);
  if (normalized.includes("consorcio andino")) return CONSORCIO_ANDINO_LOGO_BASE64;
  if (normalized.includes("consorcio nuevo norte")) return CONSORCIO_NUEVO_NORTE_LOGO_BASE64;
  return JM_LOGO_BASE64;
}

function responseSummary(items: Array<{ label: string; count: number }>) {
  return items.map((item) => `${item.label}: ${item.count}`).join(" · ");
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: "America/Santiago",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value)).replace(",", "");
}

function drawHeader(
  page: PDFPage,
  font: PDFFont,
  bold: PDFFont,
  logo: PDFImage,
  folio: string,
) {
  const { width, height } = page.getSize();
  page.drawImage(logo, { x: 45, y: height - 105, width: 92, height: 50 });
  page.drawText("Certificado de Evaluación", {
    x: 175,
    y: height - 76,
    size: 20,
    font: bold,
    color: rgb(0.07, 0.08, 0.1),
  });
  page.drawText("Psicolaboral", {
    x: 230,
    y: height - 101,
    size: 20,
    font: bold,
    color: rgb(0.07, 0.08, 0.1),
  });
  page.drawText(`Folio: PS-${folio.slice(0, 8).toUpperCase()}`, {
    x: width - 170,
    y: height - 66,
    size: 8,
    font,
    color: rgb(0.4, 0.44, 0.5),
  });
  page.drawText("Página: 1 de 1", {
    x: width - 170,
    y: height - 82,
    size: 8,
    font,
    color: rgb(0.4, 0.44, 0.5),
  });
  page.drawLine({
    start: { x: 45, y: height - 122 },
    end: { x: width - 45, y: height - 122 },
    thickness: 2,
    color: rgb(0.75, 0.07, 0.09),
  });
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método no permitido" }), {
      status: 405,
      headers: corsHeaders,
    });
  }
  const url = Deno.env.get("SUPABASE_URL")?.trim();
  const authorization = request.headers.get("authorization") ?? "";
  const secret = getSupabaseSecretKey();
  if (!url || authorization !== `Bearer ${secret}`) {
    return new Response(JSON.stringify({ error: "No autorizado" }), {
      status: 401,
      headers: corsHeaders,
    });
  }
  const client = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let assessmentId = "";
  const claimToken = crypto.randomUUID();
  let claimed = false;
  try {
    assessmentId = String(
      (await request.json() as { assessmentId?: unknown }).assessmentId ?? "",
    );
    const { data, error } = await client.rpc(
      "get_psycholaboral_certificate_payload",
      { p_assessment_id: assessmentId, p_claim_token: claimToken },
    );
    if (error || !data) {
      throw new Error(error?.message ?? "Evaluación no disponible");
    }
    claimed = true;
    const payload = data as Payload;
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([612, 792]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const logo = await pdf.embedPng(
      bytesFromBase64(resolveLogo(payload.candidate.company_name)),
    );
    drawHeader(page, font, bold, logo, payload.public_id);
    let y = 635;
    const fields = [
      ["Candidato", payload.candidate.full_name],
      ["RUN", payload.candidate.national_id],
      ["Cargo", payload.candidate.job_position_name],
      ["Contrato", payload.candidate.contract_name],
      ["Proceso", payload.candidate.case_code],
      ["Término", formatDateTime(payload.completed_at)],
    ];
    for (const [label, value] of fields) {
      page.drawText(label, { x: 50, y, size: 9, font: bold });
      page.drawText(String(value ?? ""), { x: 132, y, size: 9, font });
      y -= 19;
    }
    y -= 12;
    page.drawText("Resumen de instrumentos", {
      x: 50,
      y,
      size: 13,
      font: bold,
    });
    y -= 24;
    for (const instrument of payload.instruments) {
      page.drawText(instrument.name, { x: 50, y, size: 10, font: bold });
      y -= 15;
      for (
        const line of wrap(
          `${instrument.response_count} respuestas. ${
            formatResult(instrument.result)
          }`,
          font,
          8.5,
          500,
        )
      ) {
        page.drawText(line, { x: 60, y, size: 8.5, font });
        y -= 12;
      }
      for (
        const line of wrap(
          `Distribución de respuestas: ${
            responseSummary(instrument.response_summary)
          }`,
          font,
          7.5,
          500,
        )
      ) {
        page.drawText(line, {
          x: 60,
          y,
          size: 7.5,
          font,
          color: rgb(0.25, 0.28, 0.32),
        });
        y -= 11;
      }
      page.drawText(`Hash resultado: ${instrument.result_sha256}`, {
        x: 60,
        y,
        size: 6.5,
        font,
        color: rgb(0.45, 0.48, 0.52),
      });
      y -= 20;
    }
    page.drawText("Consentimientos", { x: 50, y, size: 11, font: bold });
    y -= 17;
    for (const consent of payload.consents) {
      page.drawText(
        `${consent.code} v${consent.version} - aceptado ${
          formatDateTime(consent.accepted_at)
        }`,
        { x: 60, y, size: 8, font },
      );
      y -= 12;
    }
    page.drawLine({
      start: { x: 205, y: 88 },
      end: { x: 407, y: 88 },
      thickness: 0.6,
      color: rgb(0.45, 0.48, 0.52),
    });
    page.drawText("Documento sellado digitalmente por el ERP", {
      x: 214,
      y: 76,
      size: 7.5,
      font: bold,
      color: rgb(0.3, 0.33, 0.37),
    });
    page.drawText(
      "Documento confidencial. El resultado es un antecedente para revisión profesional y no constituye una decisión automática de contratación.",
      { x: 50, y: 55, size: 7.5, font, color: rgb(0.35, 0.38, 0.42) },
    );
    const bytes = await pdf.save();
    const hash = await sha256(bytes);
    const path =
      `${payload.assessment_id}/certificado-psicolaboral-${payload.public_id}.pdf`;
    const { error: uploadError } = await client.storage.from(BUCKET).upload(
      path,
      bytes,
      { contentType: "application/pdf", upsert: true },
    );
    if (uploadError) throw new Error(uploadError.message);
    const { error: completeError } = await client.rpc(
      "complete_psycholaboral_certificate",
      {
        p_assessment_id: assessmentId,
        p_claim_token: claimToken,
        p_success: true,
        p_bucket: BUCKET,
        p_path: path,
        p_sha256: hash,
        p_error: null,
      },
    );
    if (completeError) throw new Error(completeError.message);
    return new Response(JSON.stringify({ generated: true, sha256: hash }), {
      headers: corsHeaders,
    });
  } catch (error) {
    if (assessmentId && claimed) {
      await client.rpc("complete_psycholaboral_certificate", {
        p_assessment_id: assessmentId,
        p_claim_token: claimToken,
        p_success: false,
        p_bucket: null,
        p_path: null,
        p_sha256: null,
        p_error: error instanceof Error ? error.message : "Error",
      });
    }
    return new Response(
      JSON.stringify({ error: "No fue posible generar el certificado" }),
      { status: 500, headers: corsHeaders },
    );
  }
});
