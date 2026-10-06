import { supabase } from "../../../shared/lib/supabase";
import { getSupabaseErrorMessage } from "../../../shared/lib/supabaseRpc";

export type CommunicationKind = "noticia" | "comunicado" | "evento" | "boletin";
export type CommunicationChannel = "editorial" | "oficial";
export type CommunicationCategory = "empresa" | "beneficios" | "personas" | "cultura" | "general" | "operaciones" | "seguridad" | "reconocimientos" | "contratos" | "equipos" | "actividades" | "campanas" | "aniversarios" | "hitos" | "procedimientos" | "instrucciones";
export type CommunicationStatus = "draft" | "published" | "scheduled" | "expired" | "archived";
export type CommunicationSaveStatus = Exclude<CommunicationStatus, "scheduled" | "expired">;
export type CommunicationBlock = { type: "paragraph" | "heading" | "quote" | "bullet_list" | "numbered_list" | "link"; text: string; url?: string };
export type CommunicationAssetType = "cover" | "image" | "video" | "attachment";
export type CommunicationIconKey = "megaphone" | "clipboard-list" | "calendar-clock" | "users" | "bus" | "award" | "sparkles" | "download";
export type CommunicationAsset = { id: string; assetType: CommunicationAssetType; filename: string; mimeType: string; sizeBytes: number };
export type CommunicationAudience = { code: string; name: string };

export type CommunicationItem = {
  id: string;
  contentType: CommunicationKind;
  channel: CommunicationChannel;
  title: string;
  summary: string;
  iconKey: CommunicationIconKey;
  body: string;
  bodyBlocks: CommunicationBlock[];
  category: CommunicationCategory;
  startsAt: string | null;
  endsAt: string | null;
  publishAt: string | null;
  expiresAt: string | null;
  audienceRoleCodes: string[];
  requiresAcknowledgement: boolean;
  hasAcknowledged: boolean;
  canAcknowledge: boolean;
  acknowledgementCount: number | null;
  coverAssetId: string | null;
  assets: CommunicationAsset[];
  externalUrl: string | null;
  isFeatured: boolean;
  status: CommunicationStatus;
  hasPdf: boolean;
  pdfFilename: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CommunicationDraft = Omit<CommunicationItem, "hasPdf" | "pdfFilename" | "publishedAt" | "createdAt" | "updatedAt" | "status" | "hasAcknowledged" | "canAcknowledge" | "acknowledgementCount" | "assets"> & {
  status: CommunicationSaveStatus;
  assets?: CommunicationAsset[];
  hasPdf?: boolean;
  pdfFilename?: string | null;
};

export type CommunicationsPortal = { canManage: boolean; items: CommunicationItem[]; audiences: CommunicationAudience[] };

type RawItem = {
  id: string;
  content_type: CommunicationKind;
  channel?: CommunicationChannel;
  title: string;
  summary: string;
  icon_key?: CommunicationIconKey | null;
  body: string;
  body_blocks?: CommunicationBlock[];
  category: CommunicationCategory;
  starts_at: string | null;
  ends_at: string | null;
  publish_at?: string | null;
  expires_at?: string | null;
  audience_role_codes?: string[];
  requires_acknowledgement?: boolean;
  has_acknowledged?: boolean;
  can_acknowledge?: boolean;
  acknowledgement_count?: number | null;
  cover_asset_id?: string | null;
  assets?: Array<{ id: string; asset_type: CommunicationAssetType; filename: string; mime_type: string; size_bytes: number }>;
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
    channel: row.channel ?? "editorial",
    title: row.title,
    summary: row.summary,
    iconKey: row.icon_key ?? "download",
    body: row.body,
    bodyBlocks: row.body_blocks ?? [],
    category: row.category,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    publishAt: row.publish_at ?? row.published_at,
    expiresAt: row.expires_at ?? null,
    audienceRoleCodes: row.audience_role_codes ?? [],
    requiresAcknowledgement: row.requires_acknowledgement === true,
    hasAcknowledged: row.has_acknowledged === true,
    canAcknowledge: row.can_acknowledge === true,
    acknowledgementCount: row.acknowledgement_count ?? null,
    coverAssetId: row.cover_asset_id ?? null,
    assets: (row.assets ?? []).map((asset) => ({ id: asset.id, assetType: asset.asset_type, filename: asset.filename, mimeType: asset.mime_type, sizeBytes: asset.size_bytes })),
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
  const payload = (data ?? {}) as { can_manage?: boolean; items?: RawItem[]; audiences?: CommunicationAudience[] };
  return { canManage: payload.can_manage === true, items: (payload.items ?? []).map(mapItem), audiences: payload.audiences ?? [] };
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
      channel: item.channel,
      title: item.title,
      summary: item.summary,
      icon_key: item.iconKey,
      body: item.bodyBlocks.length ? "" : item.body,
      body_blocks: item.bodyBlocks,
      category: item.category,
      starts_at: dateToIso(item.startsAt),
      ends_at: dateToIso(item.endsAt),
      publish_at: dateToIso(item.publishAt),
      expires_at: dateToIso(item.expiresAt),
      audience_role_codes: item.audienceRoleCodes,
      requires_acknowledgement: item.requiresAcknowledgement,
      cover_asset_id: item.coverAssetId,
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

export async function uploadCommunicationAsset(itemId: string, assetType: CommunicationAssetType, file: File): Promise<CommunicationAsset> {
  const token = await getAccessToken();
  const body = new FormData();
  body.set("itemId", itemId);
  body.set("assetType", assetType);
  body.set("file", file);
  const response = await fetch("/api/comunicaciones/assets", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body });
  const payload = await response.json().catch(() => null) as { id?: string; error?: string; filename?: string; mimeType?: string; sizeBytes?: number } | null;
  if (!response.ok || !payload?.id) throw new Error(payload?.error || "No fue posible guardar el archivo en R2.");
  return { id: payload.id, assetType, filename: payload.filename || file.name, mimeType: payload.mimeType || file.type, sizeBytes: payload.sizeBytes || file.size };
}

export async function fetchCommunicationAssetUrl(assetId: string): Promise<string> {
  const token = await getAccessToken();
  const response = await fetch(`/api/comunicaciones/assets?asset_id=${encodeURIComponent(assetId)}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error("No fue posible cargar el archivo.");
  return URL.createObjectURL(await response.blob());
}

export async function downloadCommunicationAsset(asset: CommunicationAsset) {
  const url = await fetchCommunicationAssetUrl(asset.id);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = asset.filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function acknowledgeCommunicationItem(itemId: string): Promise<string> {
  const client = await requireClient();
  const { data, error } = await client.rpc("ack_communications_item", { p_item_id: itemId });
  if (error) throw new Error(getSupabaseErrorMessage(error, "No fue posible registrar la lectura.", "message"));
  return String(data);
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
