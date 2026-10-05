import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/lib/queryKeys";
import {
  fetchCommunicationsPortal,
  saveCommunicationItem,
  uploadCommunicationBulletin,
  type CommunicationDraft
} from "../services/communicationsApi";

export function useCommunicationsPortal() {
  return useQuery({
    queryKey: queryKeys.communications.portal(),
    queryFn: fetchCommunicationsPortal,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: true
  });
}

export function useSaveCommunicationItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ item, file }: { item: CommunicationDraft; file?: File }) => {
      if (file && item.contentType !== "boletin") throw new Error("Solo los boletines admiten un PDF en esta versión.");
      if (file && item.hasPdf) throw new Error("Este boletín ya tiene un PDF asociado.");

      const contentId = await saveCommunicationItem({ ...item, status: file ? "draft" : item.status });
      if (file) await uploadCommunicationBulletin(contentId, file);
      if (file && item.status !== "draft") {
        await saveCommunicationItem({ ...item, id: contentId, hasPdf: true });
      }
      return contentId;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.communications.portal() });
    }
  });
}
