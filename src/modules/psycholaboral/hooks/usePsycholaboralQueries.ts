import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/lib/queryKeys";
import {
  fetchPsychCandidates,
  fetchPsychCatalog,
} from "../services/psycholaboralApi";
export function usePsychCatalog() {
  return useQuery({
    queryKey: queryKeys.psycholaboral.catalog(),
    queryFn: fetchPsychCatalog,
    staleTime: 30 * 60_000,
  });
}
export function usePsychCandidates(filters: {
  search: string;
  status: string;
  limit: number;
  offset: number;
}) {
  return useQuery({
    queryKey: queryKeys.psycholaboral.candidates(filters),
    queryFn: () => fetchPsychCandidates(filters),
    placeholderData: (previous) => previous,
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
}
