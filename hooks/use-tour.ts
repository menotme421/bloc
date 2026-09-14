"use client";

import * as React from "react";
import type { DriveStep } from "driver.js";
import { useI18n } from "@/lib/i18n/provider";
import { getFullTourSteps, getQuickstartSteps, type TourId } from "@/lib/tour-steps";

function seenKey(userId: string) {
  return `bloc:tour:seen:${userId || "anon"}`;
}

export function hasSeenTour(userId: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(seenKey(userId)) === "1";
  } catch {
    return true;
  }
}

export function markTourSeen(userId: string) {
  try {
    window.localStorage.setItem(seenKey(userId), "1");
  } catch {}
}

function stepElementExists(step: DriveStep): boolean {
  // The tour spans multiple routes, so most steps are absent from any given
  // page. Filter to what is actually in the DOM — otherwise Next parks on
  // the current popover (waiting/skipping) and appears dead, then jumps.
  const el = step.element;
  if (!el) return true;
  try {
    if (typeof el === "string") {
      const found = document.querySelector(el);
      // Zero-size targets (e.g. hidden mobile/desktop variants) can't be
      // highlighted usefully — treat them as missing so we skip instead
      // of pointing at an invisible rect.
      if (!found) return false;
      const rect = (found as Element).getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }
    if (typeof el === "function") {
      const found = (el as () => Element | null)();
      return !!found;
    }
    return (el as Element).isConnected !== false;
  } catch {
    return false;
  }
}

function appendDocsLink(
  wrapper: HTMLElement,
  docsUrl: string,
  label: string
) {
  // onPopoverRender fires on every step — guard against duplicates.
  if (wrapper.querySelector("[data-tour-docs-link]")) return;
  const footer = wrapper.querySelector(".driver-popover-footer");
  if (!footer) return;
  const link = document.createElement("a");
  link.setAttribute("data-tour-docs-link", "true");
  link.href = docsUrl;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = `${label} →`;
  link.className = "driver-tour-docs-link";
  // Place docs link before the progress/buttons footer for visibility.
  footer.prepend(link);
}

export function useTour(userId: string) {
  const { t } = useI18n();

  const startTour = React.useCallback(
    async (tourId: TourId) => {
      const { driver } = await import("driver.js");
      const steps: DriveStep[] =
        tourId === "quickstart" ? getQuickstartSteps(t) : getFullTourSteps(t);

      // Only drive steps whose targets are actually on this page. The tour
      // definition spans routes (editor / search / settings / …), so without
      // this Next hits absent targets and looks dead before skipping ahead.
      const visibleSteps = steps.filter(stepElementExists);
      if (visibleSteps.length === 0) {
        markTourSeen(userId);
        return null;
      }

      // Mark seen at start, not just on destroy: closing the browser
      // mid-tour never fires onDestroyed, so without this the auto-tour
      // restarts on every reopen and appears to "jump" to a later step.
      markTourSeen(userId);

      const driverObj = driver({
        showProgress: true,
        animate: true,
        allowClose: true,
        smoothScroll: true,
        overlayOpacity: 0.55,
        stagePadding: 6,
        allowKeyboardControl: true,
        nextBtnText: t("tour.next"),
        prevBtnText: t("tour.prev"),
        doneBtnText: t("tour.done"),
        steps: visibleSteps,
        onPopoverRender: (popover, { config, state }) => {
          const step = (
            state.activeStep ??
            config.steps?.[state.activeIndex ?? 0]
          ) as DriveStep | undefined;
          const docsUrl = (step?.data as { docsUrl?: string } | undefined)?.docsUrl;
          if (docsUrl) appendDocsLink(popover.wrapper, docsUrl, t("tour.learnMore"));
        },
        onDestroyed: () => {
          markTourSeen(userId);
        },
      });

      driverObj.drive();
      return driverObj;
    },
    [t, userId]
  );

  const startQuickstart = React.useCallback(
    () => startTour("quickstart"),
    [startTour]
  );
  const startFullTour = React.useCallback(() => startTour("full"), [startTour]);

  return { startTour, startQuickstart, startFullTour };
}
