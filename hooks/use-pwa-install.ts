"use client";

import * as React from "react";

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

declare global {
  interface Window {
    /** Stashed install prompt, captured early by PwaRegister. */
    __blocInstallPrompt?: BeforeInstallPromptEvent | null;
    /** Set when getInstalledRelatedApps reports this PWA installed. */
    __blocInstalledRelated?: boolean;
  }
}

export const INSTALL_READY_EVENT = "bloc:install-ready";
export const INSTALLED_EVENT = "bloc:installed";

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

function getInstalledSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  return isStandalone() || window.__blocInstalledRelated === true;
}

function subscribeInstalled(onChange: () => void) {
  const mq = window.matchMedia("(display-mode: standalone)");
  const handler = () => onChange();
  mq.addEventListener("change", handler);
  window.addEventListener("appinstalled", handler);
  window.addEventListener(INSTALLED_EVENT, handler);
  return () => {
    mq.removeEventListener("change", handler);
    window.removeEventListener("appinstalled", handler);
    window.removeEventListener(INSTALLED_EVENT, handler);
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

function takeStashedPrompt(): BeforeInstallPromptEvent | null {
  if (typeof window === "undefined") return null;
  return window.__blocInstallPrompt ?? null;
}

/**
 * PWA install state. The `beforeinstallprompt` event is captured globally
 * by PwaRegister on first load (it fires once and won't re-fire for a
 * late-mounted listener), and this hook picks the stashed event up.
 */
export function usePwaInstall() {
  const installed = React.useSyncExternalStore(
    subscribeInstalled,
    getInstalledSnapshot,
    () => false
  );
  const [deferred, setDeferred] =
    React.useState<BeforeInstallPromptEvent | null>(() =>
      takeStashedPrompt()
    );
  const [dismissed, setDismissed] = React.useState<boolean>(() =>
    wasDismissed()
  );

  React.useEffect(() => {
    // Pick up a prompt stashed before this component mounted.
    const stashed = takeStashedPrompt();
    if (stashed) setDeferred(stashed);

    const onReady = () => {
      const next = takeStashedPrompt();
      if (next) setDeferred(next);
    };
    const onBeforeInstall = (e: Event) => {
      // Backstop in case PwaRegister missed it — hold the event so the
      // in-app button can prompt on demand.
      e.preventDefault();
      const bip = e as BeforeInstallPromptEvent;
      window.__blocInstallPrompt = bip;
      setDeferred(bip);
    };
    window.addEventListener(INSTALL_READY_EVENT, onReady);
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => {
      window.removeEventListener(INSTALL_READY_EVENT, onReady);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
    };
  }, []);

  const promptInstall = React.useCallback(async () => {
    if (!deferred) return false;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    window.__blocInstallPrompt = null;
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
    /** True once running as an installed app (or known-installed). */
    installed,
    /** Native install dialog available (Chromium desktop/Android). */
    canPrompt: deferred !== null,
    /** Whether the Settings card should render at all. */
    visible: !installed && !dismissed,
    promptInstall,
    dismiss,
  };
}
