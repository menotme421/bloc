"use client";

import { useEffect } from "react";
import { syncPending } from "@/lib/note-sync";

export function SyncOnMount({ userId }: { userId: string }) {
  useEffect(() => {
    let active = true;

    const run = () => {
      if (active) {
        syncPending(userId);
      }
    };

    run();
    const interval = setInterval(run, 15_000);
    window.addEventListener("focus", run);

    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener("focus", run);
    };
  }, [userId]);

  return null;
}