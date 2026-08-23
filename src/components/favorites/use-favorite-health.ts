"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { FavoriteHealthResult } from "@/lib/favorites/health";

const HEALTH_REFRESH_INTERVAL_MS = 30_000;

type FavoriteHealthPayload = {
  items?: FavoriteHealthResult[];
};

export function useFavoriteHealth(enabledIds: readonly string[]) {
  const [healthById, setHealthById] = useState<Record<string, FavoriteHealthResult>>({});
  const [isRefreshing, setIsRefreshing] = useState(enabledIds.length > 0);
  const enabledKey = useMemo(() => [...enabledIds].sort().join(","), [enabledIds]);

  const refresh = useCallback(async () => {
    if (!enabledKey) {
      setHealthById({});
      setIsRefreshing(false);
      return;
    }

    setIsRefreshing(true);
    try {
      const response = await fetch("/api/favorites/health", { cache: "no-store" });
      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as FavoriteHealthPayload;
      setHealthById(
        Object.fromEntries((payload.items ?? []).map((item) => [item.id, item])),
      );
    } catch {
      // The last known state remains visible during a transient network failure.
    } finally {
      setIsRefreshing(false);
    }
  }, [enabledKey]);

  useEffect(() => {
    if (!enabledKey) {
      return;
    }

    const initialRefresh = window.setTimeout(() => void refresh(), 0);
    const interval = window.setInterval(() => void refresh(), HEALTH_REFRESH_INTERVAL_MS);
    return () => {
      window.clearTimeout(initialRefresh);
      window.clearInterval(interval);
    };
  }, [enabledKey, refresh]);

  return { healthById, isRefreshing, refresh };
}
