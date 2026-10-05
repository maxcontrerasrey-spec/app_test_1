import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/lib/queryKeys";
import {
  fetchCommunicationsPortal,
  saveCommunicationItem,
  uploadCommunicationBulletin,
  uploadCommunicationAsset,
  acknowledgeCommunicationItem,
  type CommunicationDraft
} from "../services/communicationsApi";

export function useCommunicationsPortal() {
  return useQuery({
    queryKey: queryKeys.communications.portal(),
    queryFn: fetchCommunicationsPortal,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true
  });
}

export function useSaveCommunicationItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ item, bulletin, cover, assets }: { item: CommunicationDraft; bulletin?: File; cover?: File; assets?: File[] }) => {
      if (bulletin && item.contentType !== "boletin") throw new Error("El PDF de boletín solo puede adjuntarse a un boletín.");
      if (bulletin && item.hasPdf) throw new Error("Este boletín ya tiene un PDF asociado.");
      if (assets?.some((file) => file.size > 50 * 1024 * 1024)) throw new Error("Cada imagen o archivo puede pesar hasta 50 MB.");
      const hasPendingFiles = Boolean(bulletin || cover || assets?.length);
      const initialStatus = hasPendingFiles && !item.id ? "draft" : item.status;
      const contentId = await saveCommunicationItem({ ...item, status: initialStatus });
      if (bulletin) await uploadCommunicationBulletin(contentId, bulletin);
      let coverAssetId = item.coverAssetId;
      if (cover) coverAssetId = (await uploadCommunicationAsset(contentId, "cover", cover)).id;
      for (const file of assets ?? []) {
        const isVideo = file.type === "video/mp4";
        await uploadCommunicationAsset(contentId, isVideo ? "video" : file.type.startsWith("image/") ? "image" : "attachment", file);
      }
      if (hasPendingFiles && item.status !== initialStatus) {
        await saveCommunicationItem({ ...item, id: contentId, coverAssetId, hasPdf: Boolean(bulletin || item.hasPdf) });
      } else if (coverAssetId && coverAssetId !== item.coverAssetId) {
        await saveCommunicationItem({ ...item, id: contentId, coverAssetId, hasPdf: item.hasPdf });
      }
      return contentId;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.communications.portal() });
    }
  });
}

export function useAcknowledgeCommunicationItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: acknowledgeCommunicationItem,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.communications.portal() });
    }
  });
}
