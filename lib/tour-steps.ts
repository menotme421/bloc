import type { DriveStep } from "driver.js";
import { DOCS } from "@/lib/docs";

export type TourId = "quickstart" | "full";

export const QUICKSTART_STEP_IDS = ["create", "title", "blocks", "search"] as const;

export const FULL_STEP_IDS = [
  "create",
  "title",
  "blocks",
  "format",
  "tag",
  "search",
  "recent",
  "sync",
  "history",
  "settings",
  "help",
] as const;

export type StepId = (typeof FULL_STEP_IDS)[number];

type TFn = (path: string, params?: Record<string, string>) => string;

export const STEP_ELEMENT: Record<StepId, string> = {
  create: '[data-tour="create-note"]',
  title: '[data-tour="note-title"]',
  blocks: '[data-tour="slash-blocks"]',
  // Inner ProseMirror node — visually distinct from the outer blocks wrapper.
  format: '[data-tour="slash-blocks"] .tiptap',
  tag: '[data-tour="note-tag"]',
  search: '[data-tour="search"]',
  recent: '[data-tour="recent"]',
  sync: '[data-tour="sync-status"]',
  history: '[data-tour="history"]',
  settings: '[data-tour="settings"]',
  help: '[data-tour="help"]',
};

const STEP_DOC: Partial<Record<StepId, string>> = {
  create: DOCS.creatingNotes,
  title: DOCS.creatingNotes,
  blocks: DOCS.editor,
  format: DOCS.editor,
  tag: DOCS.organizing,
  search: DOCS.search,
  recent: DOCS.organizing,
  sync: DOCS.offline,
  history: DOCS.history,
  settings: DOCS.appearance,
  help: DOCS.faq,
};

const STEP_SIDE: Partial<Record<StepId, "top" | "right" | "bottom" | "left">> = {
  create: "bottom",
  title: "bottom",
  blocks: "bottom",
  format: "top",
  tag: "bottom",
  search: "bottom",
  recent: "right",
  sync: "bottom",
  history: "left",
  settings: "top",
  help: "left",
};

export function buildTourSteps(t: TFn, ids: readonly StepId[]): DriveStep[] {
  return ids.map((id) => ({
    element: STEP_ELEMENT[id],
    // Don't center-popover on missing targets — skip quietly so the same
    // tour definition works on mobile, desktop, and every route.
    // NOTE: no `waitForElement` here on purpose. The tour spans multiple
    // routes (editor steps live on /app/notes/[id], settings lives on
    // /app/settings, …) so from any single page several steps are absent.
    // With waitForElement > 0 driver.js parks on the current popover for
    // that long before skipping — Next looks dead, then suddenly jumps
    // several steps (e.g. 1 → 4). `useTour` filters to on-page elements
    // before driving, so missing steps never enter the tour at all;
    // skipMissingElement stays as a last-resort safety net.
    skipMissingElement: true,
    data: STEP_DOC[id] ? { docsUrl: STEP_DOC[id] } : undefined,
    popover: {
      title: t(`tour.steps.${id}.title`),
      description: t(`tour.steps.${id}.desc`),
      side: STEP_SIDE[id] ?? "bottom",
      align: "start",
    },
  }));
}

export function getQuickstartSteps(t: TFn): DriveStep[] {
  return buildTourSteps(t, QUICKSTART_STEP_IDS);
}

export function getFullTourSteps(t: TFn): DriveStep[] {
  return buildTourSteps(t, FULL_STEP_IDS);
}
