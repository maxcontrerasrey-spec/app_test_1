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

export function clearSensitiveLocalStateForUser(userId: string | null | undefined) {
  if (!userId || typeof window === "undefined") return;

  const operationsDraftPrefix = "operations:base-register:draft:";
  for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
    const key = window.localStorage.key(index);
    if (key?.startsWith(operationsDraftPrefix) && key.endsWith(`:${userId}`)) {
      window.localStorage.removeItem(key);
    }
  }
}

export function isCurrentAuthorizationLoad(
  requestedGeneration: number,
  currentGeneration: number,
  requestedUserId: string | null,
  currentUserId: string | null
) {
  return requestedGeneration === currentGeneration && requestedUserId === currentUserId;
}
