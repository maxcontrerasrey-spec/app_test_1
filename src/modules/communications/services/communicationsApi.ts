import { supabase } from "../../../shared/lib/supabase";
import { getSupabaseErrorMessage } from "../../../shared/lib/supabaseRpc";

export type CommunicationKind = "noticia" | "comunicado" | "evento" | "boletin";
export type CommunicationCategory = "empresa" | "beneficios" | "personas" | "cultura" | "general";
export type CommunicationStatus = "draft" | "published" | "archived";

export type CommunicationItem = {
  id: string;
  contentType: CommunicationKind;
  title: string;
  summary: string;
  body: string;
  category: CommunicationCategory;
  startsAt: string | null;
  endsAt: string | null;
  externalUrl: string | null;
  isFeatured: boolean;
  status: CommunicationStatus;
  hasPdf: boolean;
  pdfFilename: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CommunicationDraft = Omit<CommunicationItem, "hasPdf" | "pdfFilename" | "publishedAt" | "createdAt" | "updatedAt"> & {
  hasPdf?: boolean;
  pdfFilename?: string | null;
};

export type CommunicationsPortal = { canManage: boolean; items: CommunicationItem[] };

type RawItem = {
  id: string;
  content_type: CommunicationKind;
  title: string;
  summary: string;
  body: string;
  category: CommunicationCategory;
  starts_at: string | null;
  ends_at: string | null;
  external_url: string | null;
  is_featured: boolean;
  status: CommunicationStatus;
  has_pdf: boolean;
  pdf_filename: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

async function requireClient() {
  if (!supabase) throw new Error("Supabase no está configurado en este entorno.");
  return supabase;
}

async function getAccessToken() {
  const client = await requireClient();
  const { data, error } = await client.auth.getSession();
  if (error) throw new Error(getSupabaseErrorMessage(error, "No fue posible validar la sesión.", "message"));
  const token = data.session?.access_token;
  if (!token) throw new Error("Tu sesión expiró. Inicia sesión nuevamente.");
  return token;
}

function mapItem(row: RawItem): CommunicationItem {
  return {
    id: row.id,
    contentType: row.content_type,
    title: row.title,
    summary: row.summary,
    body: row.body,
    category: row.category,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    externalUrl: row.external_url,
    isFeatured: row.is_featured,
    status: row.status,
    hasPdf: row.has_pdf,
    pdfFilename: row.pdf_filename,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function fetchCommunicationsPortal(): Promise<CommunicationsPortal> {
  const client = await requireClient();
  const { data, error } = await client.rpc("get_communications_portal");
  if (error) throw new Error(getSupabaseErrorMessage(error, "No fue posible cargar el portal.", "message"));
  const payload = (data ?? {}) as { can_manage?: boolean; items?: RawItem[] };
  return { canManage: payload.can_manage === true, items: (payload.items ?? []).map(mapItem) };
}

function dateToIso(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Revisa la fecha y hora del evento.");
  return date.toISOString();
}

export async function saveCommunicationItem(item: CommunicationDraft): Promise<string> {
  const client = await requireClient();
  const { data, error } = await client.rpc("save_communications_item", {
    p_item_id: item.id || null,
    p_content: {
      content_type: item.contentType,
      title: item.title,
      summary: item.summary,
      body: item.body,
      category: item.category,
      starts_at: dateToIso(item.startsAt),
      ends_at: dateToIso(item.endsAt),
      external_url: item.externalUrl || null,
      is_featured: item.isFeatured,
      status: item.status
    }
  });
  if (error) throw new Error(getSupabaseErrorMessage(error, "No fue posible guardar la publicación.", "message"));
  return String(data);
}

export async function uploadCommunicationBulletin(itemId: string, file: File) {
  const token = await getAccessToken();
  const body = new FormData();
  body.set("itemId", itemId);
  body.set("file", file);
  const response = await fetch("/api/comunicaciones/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error || "No fue posible guardar el boletín en R2.");
  }
}

export async function downloadCommunicationBulletin(item: CommunicationItem) {
  const token = await getAccessToken();
  const response = await fetch(`/api/comunicaciones/files?item_id=${encodeURIComponent(item.id)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error || "No fue posible descargar el boletín.");
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = item.pdfFilename || `${item.title}.pdf`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
