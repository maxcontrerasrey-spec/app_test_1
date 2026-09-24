import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/lib/queryKeys";
import { fetchRentStructureControl, saveRentStructureConfig, type RentStructureConfigLine, type RentStructureLegalConfig } from "../services/rentStructuresApi";

export function useRentStructureControl(contractId: number | null, jobPositionId: number | null, month: string) {
  return useQuery({
    queryKey: queryKeys.rentStructures.control(contractId, jobPositionId, month),
    queryFn: () => fetchRentStructureControl(contractId, jobPositionId, month),
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false
  });
}

export function useSaveRentStructureConfig(contractId: number | null, jobPositionId: number | null, month: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { authorizedHeadcount: number; lines: RentStructureConfigLine[]; legal: RentStructureLegalConfig }) => {
      if (!contractId || !jobPositionId) throw new Error("Selecciona un contrato y un cargo antes de guardar.");
      return saveRentStructureConfig(contractId, jobPositionId, input.authorizedHeadcount, input.lines, input.legal);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.rentStructures.control(contractId, jobPositionId, month) });
    }
  });
}
