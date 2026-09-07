"use client";

import { useEffect } from "react";
import { setOfflineAuth } from "@/lib/auth-state";

export function AuthTracker({ userId }: { userId: string | null }) {
  useEffect(() => {
    if (userId) {
      setOfflineAuth(userId);
    }
    // Never clear offline auth here — only sign-out should clear it
    // When userId is empty (offline), keep existing localStorage value
  }, [userId]);

  return null;
}
