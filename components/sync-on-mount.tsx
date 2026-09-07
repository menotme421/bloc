"use client";

import { useEffect, useRef } from "react";
import { syncPending } from "@/lib/note-sync";
import { getOfflineAuth } from "@/lib/auth-state";
import { getOutbox } from "@/lib/local-notes";
import { setSyncStatus } from "@/lib/note-status";

export function SyncOnMount({ userId }: { userId: string }) {
  const resolvedRef = useRef(userId);

  useEffect(() => {
    if (!resolvedRef.current && typeof window !== "undefined") {
      const offlineAuth = getOfflineAuth();
      if (offlineAuth?.userId) {
        resolvedRef.current = offlineAuth.userId;
      }
    }

    const uid = resolvedRef.current;
    if (!uid) return;

    let active = true;

    // Seed badge truthfully: offline browser or pending outbox => offline
    if (typeof window !== "undefined") {
      try {
        const hasPending = getOutbox(uid).length > 0;
        if (!window.navigator.onLine || hasPending) {
          setSyncStatus("offline");
        }
      } catch {}
    }

    const run = () => {
      if (active) {
        syncPending(uid);
      }
    };

    const onOnline = () => {
      run();
    };
    const onOffline = () => {
      setSyncStatus("offline");
    };

    run();
    const interval = setInterval(run, 15_000);
    window.addEventListener("focus", run);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener("focus", run);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [userId]);

  return null;
}