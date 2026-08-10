import { useCallback, useMemo } from "react";
import { PageShell } from "../../../shared/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useRealtimeQueryInvalidation } from "../../../shared/hooks/useRealtimeQueryInvalidation";
import { queryKeys } from "../../../shared/lib/queryKeys";
import { SanctionsModuleView } from "../components/SanctionsModuleView";

export function SanctionsPage() {
  const queryClient = useQueryClient();
  const subscriptions = useMemo(
    () => [
      { table: "hr_sanction_requests" },
      { table: "hr_sanction_documents" },
      { table: "hr_sanction_request_history" }
    ],
    []
  );

  const invalidateSanctions = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.sanctions.requestsRoot() });
    await queryClient.invalidateQueries({ queryKey: queryKeys.sanctions.requestDetailRoot() });
  }, [queryClient]);

  useRealtimeQueryInvalidation({
    channelName: "hr-sanctions",
    invalidate: invalidateSanctions,
    subscriptions
  });

  return (
    <PageShell>
      <div className="minimal-page-header">
        <h1>Solicitud de Sanciones</h1>
      </div>
      <section className="tracking-panel">
        <SanctionsModuleView />
      </section>
    </PageShell>
  );
}
