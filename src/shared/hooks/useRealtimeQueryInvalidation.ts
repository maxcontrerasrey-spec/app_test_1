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

export function useRealtimeQueryInvalidation({
  channelName,
  subscriptions,
  queryKeys = [],
  invalidate,
  enabled = true,
  debounceMs = 350
}: RealtimeInvalidationOptions) {
  const queryClient = useQueryClient();
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!supabase || !enabled || subscriptions.length === 0) {
      return;
    }

    const supabaseClient = supabase;

    const runInvalidation = () => {
      if (invalidate) {
        void invalidate(queryClient);
        return;
      }

      queryKeys.forEach((queryKey) => {
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

    subscriptions.forEach((subscription) => {
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
  }, [channelName, debounceMs, enabled, invalidate, queryClient, queryKeys, subscriptions]);
}
