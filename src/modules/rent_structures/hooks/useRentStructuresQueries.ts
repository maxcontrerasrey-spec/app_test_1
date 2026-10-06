import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/lib/queryKeys";
import { fetchRentStructureControl, saveRentStructureConfig, type RentStructureConfigLine, type RentStructureLegalConfig, type RentRegimeCode } from "../services/rentStructuresApi";

export function useRentStructureControl(contractId: number | null, jobPositionId: number | null) {
  return useQuery({
    queryKey: queryKeys.rentStructures.control(contractId, jobPositionId),
    queryFn: () => fetchRentStructureControl(contractId, jobPositionId),
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    // El RPC vuelve a entregar catálogo + detalle. Conservamos la lista mientras
    // cambia el detalle para que el click no parezca perdido durante la consulta.
    placeholderData: (previous) => previous
  });
}

export function useSaveRentStructureConfig(contractId: number | null, jobPositionId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { authorizedHeadcount: number; lines: RentStructureConfigLine[]; legal: RentStructureLegalConfig; shiftIds: number[]; legalRegimeCode: RentRegimeCode | null }) => {
      if (!contractId || !jobPositionId) throw new Error("Selecciona un contrato y un cargo antes de guardar.");
      return saveRentStructureConfig(contractId, jobPositionId, input.authorizedHeadcount, input.lines, input.legal, input.shiftIds, input.legalRegimeCode);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.rentStructures.control(contractId, jobPositionId) });
    }
  });
}
