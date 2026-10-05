import { supabase } from "../../../shared/lib/supabase";
import { getSupabaseErrorMessage } from "../../../shared/lib/supabaseRpc";
import { DEFAULT_COMMUNICATIONS_SITE, type CommunicationsSiteData } from "../site/communicationsSiteConfig";

export type CommunicationsSiteVersion = {
  version: number;
  publishedAt: string;
  publishedBy: string | null;
  restoredFromVersion: number | null;
};

export type CommunicationsSite = {
  canManage: boolean;
  publishedData: CommunicationsSiteData;
  publishedVersion: number;
  publishedAt: string | null;
  draftData: CommunicationsSiteData | null;
  draftRevision: number | null;
  versions: CommunicationsSiteVersion[];
};

type RawVersion = {
  version: number;
  published_at: string;
  published_by: string | null;
  restored_from_version: number | null;
};

type RawSite = {
  can_manage?: boolean;
  published_data?: CommunicationsSiteData;
  published_version?: number;
  published_at?: string | null;
  draft_data?: CommunicationsSiteData | null;
  draft_revision?: number | null;
  versions?: RawVersion[];
};

async function requireClient() {
  if (!supabase) throw new Error("Supabase no está configurado en este entorno.");
  return supabase;
}

export async function fetchCommunicationsSite(): Promise<CommunicationsSite> {
  const client = await requireClient();
  const { data, error } = await client.rpc("get_communications_site");
  if (error) throw new Error(getSupabaseErrorMessage(error, "No fue posible cargar el diseño del portal.", "message"));
  const payload = (data ?? {}) as RawSite;
  return {
    canManage: payload.can_manage === true,
    publishedData: payload.published_data ?? DEFAULT_COMMUNICATIONS_SITE,
    publishedVersion: payload.published_version ?? 1,
    publishedAt: payload.published_at ?? null,
    draftData: payload.draft_data ?? null,
    draftRevision: payload.draft_revision ?? null,
    versions: (payload.versions ?? []).map((version) => ({
      version: version.version,
      publishedAt: version.published_at,
      publishedBy: version.published_by,
      restoredFromVersion: version.restored_from_version
    }))
  };
}

export async function saveCommunicationsSiteDraft(data: CommunicationsSiteData, expectedRevision: number) {
  const client = await requireClient();
  const { data: revision, error } = await client.rpc("save_communications_site_draft", {
    p_data: data,
    p_expected_revision: expectedRevision
  });
  if (error) throw new Error(getSupabaseErrorMessage(error, "No fue posible guardar el borrador.", "message"));
  return Number(revision);
}

export async function publishCommunicationsSite(expectedRevision: number) {
  const client = await requireClient();
  const { data: version, error } = await client.rpc("publish_communications_site", {
    p_expected_revision: expectedRevision
  });
  if (error) throw new Error(getSupabaseErrorMessage(error, "No fue posible publicar el portal.", "message"));
  return Number(version);
}

export async function restoreCommunicationsSiteVersion(version: number, expectedRevision: number) {
  const client = await requireClient();
  const { data: newVersion, error } = await client.rpc("restore_communications_site_version", {
    p_version: version,
    p_expected_revision: expectedRevision
  });
  if (error) throw new Error(getSupabaseErrorMessage(error, "No fue posible restaurar esta versión.", "message"));
  return Number(newVersion);
}
