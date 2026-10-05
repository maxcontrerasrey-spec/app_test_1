import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/lib/queryKeys";
import {
  fetchCommunicationsSite,
  publishCommunicationsSite,
  restoreCommunicationsSiteVersion,
  saveCommunicationsSiteDraft
} from "../services/communicationsSiteApi";
import type { CommunicationsSiteData } from "../site/communicationsSiteConfig";

export function useCommunicationsSite() {
  return useQuery({
    queryKey: queryKeys.communications.site(),
    queryFn: fetchCommunicationsSite,
    staleTime: 30_000,
    refetchOnWindowFocus: true
  });
}

export function useCommunicationsSiteActions() {
  const client = useQueryClient();
  const reload = () => client.invalidateQueries({ queryKey: queryKeys.communications.site() });

  return {
    saveDraft: async (data: CommunicationsSiteData, revision: number) => {
      const nextRevision = await saveCommunicationsSiteDraft(data, revision);
      await reload();
      return nextRevision;
    },
    publish: async (revision: number) => {
      const version = await publishCommunicationsSite(revision);
      await reload();
      return version;
    },
    restore: async (version: number, revision: number) => {
      const publishedVersion = await restoreCommunicationsSiteVersion(version, revision);
      await reload();
      return publishedVersion;
    }
  };
}
