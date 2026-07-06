import { useEffect, useMemo } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";

type RealtimeBinding = {
  table: string;
  queryKeys: QueryKey[];
};

function keyId(key: QueryKey) {
  return JSON.stringify(key);
}

export function useRealtimeInvalidation({
  client,
  enabled,
  channelName,
  bindings,
}: {
  client: SupabaseClient<any, any, any>;
  enabled: boolean;
  channelName: string;
  bindings: RealtimeBinding[];
}) {
  const queryClient = useQueryClient();
  const allKeys = useMemo(() => {
    const unique = new Map<string, QueryKey>();
    for (const binding of bindings) {
      for (const key of binding.queryKeys) unique.set(keyId(key), key);
    }
    return Array.from(unique.values());
  }, [bindings]);

  useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const pending = new Map<string, QueryKey>();

    const flush = () => {
      timer = null;
      const keys = Array.from(pending.values());
      pending.clear();
      for (const queryKey of keys) {
        queryClient.invalidateQueries({ queryKey });
      }
    };

    const schedule = (keys: QueryKey[]) => {
      for (const key of keys) pending.set(keyId(key), key);
      if (timer) return;
      timer = setTimeout(flush, 120);
    };

    const channel = client.channel(channelName);
    for (const binding of bindings) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: binding.table },
        () => schedule(binding.queryKeys),
      );
    }

    channel.subscribe((status) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        schedule(allKeys);
      }
    });

    const refreshVisibleData = () => schedule(allKeys);
    const refreshOnVisibility = () => {
      if (document.visibilityState === "visible") refreshVisibleData();
    };

    window.addEventListener("focus", refreshVisibleData);
    window.addEventListener("online", refreshVisibleData);
    document.addEventListener("visibilitychange", refreshOnVisibility);

    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("focus", refreshVisibleData);
      window.removeEventListener("online", refreshVisibleData);
      document.removeEventListener("visibilitychange", refreshOnVisibility);
      client.removeChannel(channel);
    };
  }, [allKeys, bindings, channelName, client, enabled, queryClient]);
}