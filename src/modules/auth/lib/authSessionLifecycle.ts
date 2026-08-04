import type { QueryClient } from "@tanstack/react-query";

type SessionScopedQueryClient = Pick<QueryClient, "cancelQueries" | "clear">;

export function didSessionIdentityChange(
  previousUserId: string | null,
  nextUserId: string | null
) {
  return previousUserId !== nextUserId;
}

export function resetSessionScopedQueries(queryClient: SessionScopedQueryClient) {
  void queryClient.cancelQueries();
  queryClient.clear();
}

export function isCurrentAuthorizationLoad(
  requestedGeneration: number,
  currentGeneration: number,
  requestedUserId: string | null,
  currentUserId: string | null
) {
  return requestedGeneration === currentGeneration && requestedUserId === currentUserId;
}
