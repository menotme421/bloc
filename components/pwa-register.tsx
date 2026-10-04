"use client";

import { useEffect } from "react";
import {
  INSTALLED_EVENT,
  INSTALL_READY_EVENT,
  type BeforeInstallPromptEvent,
} from "@/hooks/use-pwa-install";

type InstalledRelatedApp = {
  platform: string;
  url?: string;
  id?: string;
};

/**
 * If this PWA is already installed on the device, Chromium suppresses
 * `beforeinstallprompt` — even in a regular browser tab. Self-listing in
 * the manifest's `related_applications` lets us detect that and hide
 * install UI instead of showing a dead-end guide.
 */
async function flagInstalledRelatedApp(): Promise<void> {
  try {
    const nav = navigator as Navigator & {
      getInstalledRelatedApps?: () => Promise<InstalledRelatedApp[]>;
    };
    if (typeof nav.getInstalledRelatedApps !== "function") return;
    const related = await nav.getInstalledRelatedApps();
    if (related.some((app) => app.platform === "webapp")) {
      window.__blocInstalledRelated = true;
      window.dispatchEvent(new Event(INSTALLED_EVENT));
    }
  } catch {
    // API unavailable or denied — install UI just stays visible.
  }
}

export function PwaRegister() {
  useEffect(() => {
    // Capture the install prompt at first load: it fires once per page
    // load and won't re-fire for listeners attached later (e.g. when
    // the user navigates to Settings client-side).
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      window.__blocInstallPrompt = e as BeforeInstallPromptEvent;
      window.dispatchEvent(new Event(INSTALL_READY_EVENT));
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    void flagInstalledRelatedApp();

    let onControllerChange: (() => void) | null = null;
    if ("serviceWorker" in navigator) {

    let refreshing = false;
    onControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });

        // If there's already a waiting worker, activate it
        if (reg.waiting) {
          reg.waiting.postMessage({ type: "SKIP_WAITING" });
        }

        reg.addEventListener("updatefound", () => {
          const sw = reg.installing;
          if (!sw) return;
          sw.addEventListener("statechange", () => {
            if (sw.state === "installed" && navigator.serviceWorker.controller) {
              // New content available — activate immediately then reload via controllerchange
              reg.waiting?.postMessage({ type: "SKIP_WAITING" });
            }
          });
        });

        // Periodic check (hourly)
        setInterval(() => {
          reg.update().catch(() => {});
        }, 60 * 60 * 1000);
      } catch {
        // Registration failed — silently ignore (e.g. insecure context)
      }
    };

    register();
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      if (onControllerChange) {
        try {
          navigator.serviceWorker.removeEventListener(
            "controllerchange",
            onControllerChange
          );
        } catch {}
      }
    };
  }, []);

  return null;
}
