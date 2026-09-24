import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/lib/queryKeys";
import { fetchRentStructureControl } from "../services/rentStructuresApi";

export function useRentStructureControl(contractId: number | null, jobPositionId: number | null) {
  return useQuery({
    queryKey: queryKeys.rentStructures.control(contractId, jobPositionId),
    queryFn: () => fetchRentStructureControl(contractId, jobPositionId),
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false
  });
}
