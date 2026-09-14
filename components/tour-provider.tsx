"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import "driver.js/dist/driver.css";
import { hasSeenTour, useTour } from "@/hooks/use-tour";

// Redirect stubs render nothing tourable — starting here would burn the
// one-time auto tour on an empty page (it redirects immediately after).
const STUB_ROUTES = new Set(["/app", "/app/notes"]);

// Side-effect only: auto-starts the 4-step quickstart once per user,
// then never again (manual replay lives in HelpMenu / Help page).
export function TourProvider({ userId }: { userId: string }) {
  const pathname = usePathname();
  const { startQuickstart } = useTour(userId);

  React.useEffect(() => {
    if (!userId) return;
    if (STUB_ROUTES.has(pathname)) return;
    if (hasSeenTour(userId)) return;
    // Let the DOM paint (sidebar/editor load async) before highlighting.
    const timeout = window.setTimeout(() => {
      // Bail if the user already dismissed in another tab.
      if (hasSeenTour(userId)) return;
      // Don't drive on a page with no tour targets (e.g. mid-redirect).
      if (!document.querySelector("[data-tour]")) return;
      void startQuickstart();
    }, 900);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, pathname]);

  return null;
}
