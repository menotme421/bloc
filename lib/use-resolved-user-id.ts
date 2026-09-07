"use client";

import * as React from "react";
import { getOfflineAuth } from "@/lib/auth-state";
import { adoptOrphanedNotes } from "@/lib/local-notes";

/**
 * Resolve the effective userId for local-first reads/writes.
 * Server may render with "" offline; client patches from bloc:auth
 * localStorage (written by AuthTracker while online).
 * Also adopts any notes accidentally stored under the empty "" bucket.
 */
export function useResolvedUserId(propUserId: string): string {
  const [resolved, setResolved] = React.useState(propUserId);

  // Intentional post-hydration sync from localStorage (client-only).
  React.useEffect(() => {
    if (propUserId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResolved(propUserId);
      return;
    }
    if (typeof window === "undefined") return;
    const offlineAuth = getOfflineAuth();
    if (offlineAuth?.userId) {
      adoptOrphanedNotes(offlineAuth.userId);
      setResolved(offlineAuth.userId);
    }
  }, [propUserId]);

  React.useEffect(() => {
    if (resolved) adoptOrphanedNotes(resolved);
  }, [resolved]);

  return resolved;
}
