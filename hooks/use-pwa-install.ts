"use client";

import * as React from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "bloc:pwa-install:dismissed";

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  try {
    if (
      (window.navigator as Navigator & { standalone?: boolean })
        .standalone === true
    )
      return true;
  } catch {}
  return false;
}

function subscribeInstalled(onChange: () => void) {
  const mq = window.matchMedia("(display-mode: standalone)");
  const handler = () => onChange();
  mq.addEventListener("change", handler);
  window.addEventListener("appinstalled", handler);
  return () => {
    mq.removeEventListener("change", handler);
    window.removeEventListener("appinstalled", handler);
  };
}

export function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function wasDismissed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * PWA install state. Captures `beforeinstallprompt` so an in-app
 * "Install app" button can trigger the native dialog instead of
 * making the user hunt through the browser menu.
 */
export function usePwaInstall() {
  const installed = React.useSyncExternalStore(
    subscribeInstalled,
    isStandalone,
    () => false
  );
  const [deferred, setDeferred] =
    React.useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = React.useState<boolean>(() =>
    wasDismissed()
  );

  React.useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      // Hold the event so the in-app button can prompt on demand.
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () =>
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  const promptInstall = React.useCallback(async () => {
    if (!deferred) return false;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    if (outcome === "dismissed") {
      try {
        window.localStorage.setItem(DISMISS_KEY, "1");
      } catch {}
      setDismissed(true);
    }
    return outcome === "accepted";
  }, [deferred]);

  const dismiss = React.useCallback(() => {
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
    setDismissed(true);
  }, []);

  return {
    /** True once running as an installed app. */
    installed,
    /** Native install dialog available (Chromium desktop/Android). */
    canPrompt: deferred !== null,
    /** Whether the Settings card should render at all. */
    visible: !installed && !dismissed,
    promptInstall,
    dismiss,
  };
}
