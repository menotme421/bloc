"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { FileTextIcon, PencilIcon, Trash2Icon } from "lucide-react";
import type { Note } from "@/lib/notes";
import { TagChip } from "@/components/tag-chip";
import {
  markNoteOpened,
  getLocalNote,
  upsertLocalNote,
  addOutboxEntry,
  removeLocalNote,
  removeOutboxEntry,
  addTombstone,
  removeTombstone,
  getLastNoteId,
  clearLastNoteId,
} from "@/lib/local-notes";
import { syncNote } from "@/lib/note-sync";
import { deleteNote } from "@/app/app/notes/actions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/provider";
import { openNote } from "@/lib/open-note";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

function excerptFromHtml(html: string, len = 90): string {
  const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length > len ? text.slice(0, len) + "…" : text;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const day = 86400000;
  if (diff < day && d.getDate() === now.getDate()) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (diff < 7 * day) {
    return d.toLocaleDateString([], { weekday: "short" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

const LONG_PRESS_MS = 500;
const MOVE_THRESHOLD = 10;

export function MobileNoteCard({
  userId,
  note,
  className,
  variant = "grid",
}: {
  userId: string;
  note: Note;
  className?: string;
  variant?: "grid" | "list";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useI18n();
  const excerpt = excerptFromHtml(note.content);

  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [renameOpen, setRenameOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [draft, setDraft] = React.useState(note.title);

  const timerRef = React.useRef<number | null>(null);
  const startPosRef = React.useRef<{ x: number; y: number } | null>(null);
  const longFiredRef = React.useRef(false);
  const suppressClickRef = React.useRef(false);

  React.useEffect(() => {
    setDraft(note.title);
  }, [note.title]);

  function clearTimer() {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function handlePointerDown(e: React.PointerEvent) {
    // only primary pointer
    if (e.button !== 0) return;
    longFiredRef.current = false;
    startPosRef.current = { x: e.clientX, y: e.clientY };
    timerRef.current = window.setTimeout(() => {
      longFiredRef.current = true;
      suppressClickRef.current = true;
      if (navigator.vibrate) navigator.vibrate(20);
      setSheetOpen(true);
      // reset suppress after next click
      setTimeout(() => (suppressClickRef.current = false), 600);
    }, LONG_PRESS_MS);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!startPosRef.current || timerRef.current === null) return;
    const dx = Math.abs(e.clientX - startPosRef.current.x);
    const dy = Math.abs(e.clientY - startPosRef.current.y);
    if (dx > MOVE_THRESHOLD || dy > MOVE_THRESHOLD) {
      clearTimer();
    }
  }

  function handlePointerUp() {
    const wasLong = longFiredRef.current;
    clearTimer();
    startPosRef.current = null;
    if (wasLong) {
      // prevent click navigation
      return;
    }
  }

  function handlePointerCancel() {
    clearTimer();
    startPosRef.current = null;
  }

  function handleClick() {
    if (suppressClickRef.current || longFiredRef.current) {
      // consumed by long press
      longFiredRef.current = false;
      return;
    }
    markNoteOpened(userId, note.id);
    // From a note to another note, replace to avoid stacking notes in history.
    // Home/Search -> note should push so back returns to home.
    openNote(router, note.id, pathname?.startsWith("/app/notes/"));
  }

  function commitRename() {
    const title = draft.trim();
    setRenameOpen(false);
    if (!title || title === note.title) return;
    const existing = getLocalNote(userId, note.id);
    if (!existing) return;
    const updated: Note = {
      ...existing,
      title,
      updated_at: new Date().toISOString(),
    };
    upsertLocalNote(userId, updated);
    addOutboxEntry(userId, { note: updated, mode: "update" });
    void syncNote(userId, updated, "update");
  }

  function handleDelete() {
    setDeleteOpen(false);
    setSheetOpen(false);
    removeLocalNote(userId, note.id);
    removeOutboxEntry(userId, note.id);
    addTombstone(userId, note.id);
    if (getLastNoteId(userId) === note.id) {
      clearLastNoteId(userId);
    }
    // if currently on that note, redirect is handled by parent navigation, but we are in home/search grid - remain
    void deleteNote(note.id).then((result) => {
      if (result.ok) {
        removeTombstone(userId, note.id);
      }
    });
  }

  const isList = variant === "list";

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerLeave={handlePointerCancel}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClick();
          }
        }}
        onContextMenu={(e) => e.preventDefault()}
        className={cn(
          "group flex shadow-sm transition-colors hover:bg-muted/40 active:bg-muted select-none touch-manipulation rounded-xl border bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isList
            ? "flex-row items-center gap-3 p-3"
            : "flex-col gap-2 p-3.5",
          className
        )}
        style={{ WebkitTouchCallout: "none" } as React.CSSProperties}
      >
        {isList ? (
          <>
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:bg-background">
              <FileTextIcon className="size-4" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold leading-tight">
                  {note.title.trim() || t("common.untitled")}
                </span>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {formatDate(note.updated_at)}
                </span>
              </div>
              {excerpt && (
                <p className="truncate text-xs leading-relaxed text-muted-foreground">
                  {excerpt}
                </p>
              )}
              {note.tag && (
                <div className="pt-0.5">
                  <TagChip tag={note.tag} onClick={() => router.push(`/app/search?tag=${encodeURIComponent(note.tag!)}`)} className="h-5 text-[11px]" />
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:bg-background">
                  <FileTextIcon className="size-3.5" />
                </span>
                <span className="truncate text-sm font-semibold leading-tight">
                  {note.title.trim() || t("common.untitled")}
                </span>
              </div>
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {formatDate(note.updated_at)}
              </span>
            </div>
            {excerpt && (
              <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                {excerpt}
              </p>
            )}
            {note.tag && (
              <div className="pt-1">
                <TagChip tag={note.tag} onClick={() => router.push(`/app/search?tag=${encodeURIComponent(note.tag!)}`)} className="h-5 text-[11px]" />
              </div>
            )}
          </>
        )}
      </div>

      {/* Long-press action sheet — mobile only, bottom sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl px-0 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2"
          showCloseButton={false}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Note actions</SheetTitle>
            <SheetDescription>Choose an action for this note</SheetDescription>
          </SheetHeader>
          {/* drag handle */}
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-muted" />
          <div className="px-4 pb-2">
            <p className="truncate text-sm font-semibold">
              {note.title.trim() || t("common.untitled")}
            </p>
            <p className="truncate text-xs text-muted-foreground">{t("notes.longPressActions")}</p>
          </div>
          <div className="flex flex-col gap-1 px-2">
            <button
              type="button"
              onClick={() => {
                setSheetOpen(false);
                setDraft(note.title);
                setRenameOpen(true);
              }}
              className="flex items-center gap-3 rounded-xl px-4 py-3.5 text-left text-sm font-medium hover:bg-muted active:bg-muted"
            >
              <PencilIcon className="size-4 text-muted-foreground" />
              {t("notes.rename")}
            </button>
            <button
              type="button"
              onClick={() => {
                setSheetOpen(false);
                setDeleteOpen(true);
              }}
              className="flex items-center gap-3 rounded-xl px-4 py-3.5 text-left text-sm font-medium text-destructive hover:bg-destructive/10 active:bg-destructive/10"
            >
              <Trash2Icon className="size-4" />
              {t("notes.delete")}
            </button>
          </div>
          <div className="px-4 pt-3">
            <Button
              variant="outline"
              className="w-full rounded-xl"
              onClick={() => setSheetOpen(false)}
            >
              {t("common.cancel")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Rename dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("notes.renameNote")}</DialogTitle>
            <DialogDescription>{t("notes.renameNoteDesc")}</DialogDescription>
          </DialogHeader>
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t("notes.noteTitlePlaceholder")}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") setRenameOpen(false);
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={commitRename} disabled={!draft.trim() || draft.trim() === note.title}>
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("notes.deleteNoteTitle")}</DialogTitle>
            <DialogDescription>
              {t("notes.deleteNoteDesc", { title: note.title.trim() || t("common.untitled") })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              {t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
