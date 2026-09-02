import { useEffect, useRef } from "react";
import { useQueryClient, type QueryClient, type QueryKey } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { logger } from "../lib/logger";

type RealtimeEvent = "*" | "INSERT" | "UPDATE" | "DELETE";

type RealtimeSubscription = {
  table: string;
  schema?: string;
  event?: RealtimeEvent;
  filter?: string;
};

type RealtimeInvalidationOptions = {
  channelName: string;
  subscriptions: RealtimeSubscription[];
  queryKeys?: QueryKey[];
  invalidate?: (queryClient: QueryClient) => Promise<unknown> | unknown;
  enabled?: boolean;
  debounceMs?: number;
};

const EMPTY_KEYS: QueryKey[] = [];

function subscriptionSignature(subscriptions: RealtimeSubscription[]) {
  return subscriptions
    .map(({ table, schema = "public", event = "*", filter = "" }) =>
      [schema, table, event, filter].join("\u001f")
    )
    .join("\u001e");
}

export function useRealtimeQueryInvalidation({
  channelName,
  subscriptions,
  queryKeys = EMPTY_KEYS,
  invalidate,
  enabled = true,
  debounceMs = 350
}: RealtimeInvalidationOptions) {
  const queryClient = useQueryClient();
  const debounceRef = useRef<number | null>(null);
  const subscriptionsRef = useRef(subscriptions);
  const queryKeysRef = useRef(queryKeys);
  const invalidateRef = useRef(invalidate);
  subscriptionsRef.current = subscriptions;
  queryKeysRef.current = queryKeys;
  invalidateRef.current = invalidate;
  const subscriptionsKey = subscriptionSignature(subscriptions);

  useEffect(() => {
    if (!supabase || !enabled || subscriptionsRef.current.length === 0) {
      return;
    }

    const supabaseClient = supabase;

    const runInvalidation = () => {
      if (invalidateRef.current) {
        void invalidateRef.current(queryClient);
        return;
      }

      queryKeysRef.current.forEach((queryKey) => {
        void queryClient.invalidateQueries({ queryKey });
      });
    };

    const scheduleInvalidation = () => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
      }

      debounceRef.current = window.setTimeout(() => {
        debounceRef.current = null;
        runInvalidation();
      }, debounceMs);
    };

    const channel = supabaseClient.channel(channelName);

    subscriptionsRef.current.forEach((subscription) => {
      channel.on(
        "postgres_changes",
        {
          event: subscription.event ?? "*",
          schema: subscription.schema ?? "public",
          table: subscription.table,
          filter: subscription.filter
        },
        scheduleInvalidation
      );
    });

    channel.subscribe((status) => {
      if (status === "CHANNEL_ERROR") {
        logger.warn(`Realtime channel error: ${channelName}`);
      }
    });

    return () => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }

      void supabaseClient.removeChannel(channel);
    };
  }, [channelName, debounceMs, enabled, queryClient, subscriptionsKey]);
}
