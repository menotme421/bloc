"use client";

import * as React from "react";
import {
  ArrowLeftIcon,
  FileTextIcon,
  LayoutGridIcon,
  ListIcon,
  PlusIcon,
  RefreshCwIcon,
} from "lucide-react";
import {
  EMPTY_NOTES,
  adoptOrphanedNotes,
  addTombstone,
  clearLastNoteId,
  createLocalNote,
  getAllNotesSnapshot,
  getLastNoteId,
  getNoteSnapshot,
  getOutbox,
  getRecentOpenedNotesSnapshot,
  markNoteOpened,
  removeLocalNote,
  removeOutboxEntry,
  subscribeNotes,
} from "@/lib/local-notes";
import { getOfflineAuth } from "@/lib/auth-state";
import { syncPending } from "@/lib/note-sync";
import { getSyncStatus, subscribeSyncStatus } from "@/lib/note-status";
import { useResolvedUserId } from "@/lib/use-resolved-user-id";
import { useI18n } from "@/lib/i18n/provider";
import { NoteEditor } from "@/components/note-editor";
import { TagChip } from "@/components/tag-chip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Offline shell mirrors the app home + note visuals (same brand header,
// view toggle, note cards, h-14 editor bar, sync badges) so offline feels
// like the same interface. /offline is the one precached document, so after
// a kill + offline restart all CRUD happens here with zero navigation
// (a new /app/notes/<uuid> needs a server RSC fetch).

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

function SyncBadge({ userId }: { userId: string }) {
  const syncStatus = React.useSyncExternalStore(
    subscribeSyncStatus,
    getSyncStatus,
    () => "synced" as const
  );
  if (syncStatus === "saving") {
    return (
      <Badge variant="outline" className="gap-1.5 text-warning">
        <span className="size-1.5 animate-pulse rounded-full bg-current" />
        Saving…
      </Badge>
    );
  }
  if (syncStatus === "offline") {
    return (
      <>
        <Badge variant="outline" className="gap-1.5 text-destructive">
          <span className="size-1.5 rounded-full bg-current" />
          Offline
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          aria-label="Retry sync"
          onClick={() => {
            if (userId) void syncPending(userId);
          }}
        >
          <RefreshCwIcon className="size-3.5" />
          Retry
        </Button>
      </>
    );
  }
  return (
    <Badge variant="outline" className="gap-1.5 text-success">
      <span className="size-1.5 rounded-full bg-current" />
      Synced
    </Badge>
  );
}

export function OfflineShell() {
  const userId = useResolvedUserId("");
  const { t } = useI18n();
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [view, setView] = React.useState<"grid" | "list">("grid");
  const [tagFilter, setTagFilter] = React.useState<string | null>(null);

  const storageKey = `bloc:home:view:${userId}`;
  React.useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey) as "grid" | "list" | null;
      if (saved === "grid" || saved === "list") setView(saved);
    } catch {}
  }, [storageKey]);

  function updateView(next: "grid" | "list") {
    setView(next);
    try {
      window.localStorage.setItem(storageKey, next);
    } catch {}
  }

  const recent = React.useSyncExternalStore(
    subscribeNotes,
    // eslint-disable-next-line react-hooks/incompatible-library
    () => (userId ? getRecentOpenedNotesSnapshot(userId, 5) : EMPTY_NOTES),
    () => EMPTY_NOTES
  );

  const allNotes = React.useSyncExternalStore(
    subscribeNotes,
    // eslint-disable-next-line react-hooks/incompatible-library
    () => (userId ? getAllNotesSnapshot(userId) : EMPTY_NOTES),
    () => EMPTY_NOTES
  );

  const created = React.useMemo(() => {
    const sorted = [...allNotes].sort(
      (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)
    );
    if (!tagFilter) return sorted;
    return sorted.filter((n) => n.tag === tagFilter);
  }, [allNotes, tagFilter]);

  React.useEffect(() => {
    if (userId) adoptOrphanedNotes(userId);
  }, [userId]);

  React.useEffect(() => {
    if (!userId) return;
    const onOnline = () => void syncPending(userId);
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [userId]);

  const pending = userId ? getOutbox(userId).length : 0;
  const selected = userId && selectedId ? getNoteSnapshot(userId, selectedId) : null;

  function handleCreate() {
    if (!userId) return;
    const note = createLocalNote(userId);
    markNoteOpened(userId, note.id);
    setSelectedId(note.id);
  }

  function handleDelete(id: string) {
    if (!userId) return;
    removeLocalNote(userId, id);
    removeOutboxEntry(userId, id);
    addTombstone(userId, id);
    if (getLastNoteId(userId) === id) clearLastNoteId(userId);
    if (selectedId === id) setSelectedId(null);
  }

  function openInline(id: string) {
    if (!userId) return;
    markNoteOpened(userId, id);
    setSelectedId(id);
  }

  if (!userId && typeof window !== "undefined" && !getOfflineAuth()) {
    return (
      <main className="min-h-dvh flex flex-col items-center justify-center p-6 text-center bg-background text-foreground">
        <div className="max-w-md w-full space-y-4">
          <h1 className="text-2xl font-semibold tracking-tight">You are offline</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Sign in once while online, then your notes work offline.
          </p>
        </div>
      </main>
    );
  }

  // ── Editor view (mirrors /app/notes/[id]: h-14 bar + editor) ──
  if (selectedId) {
    return (
      <main className="min-h-dvh flex flex-col bg-background text-foreground">
        <header className="flex h-14 shrink-0 items-center gap-2">
          <div className="flex flex-1 items-center gap-2 px-3">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Back to home"
              onClick={() => setSelectedId(null)}
            >
              <ArrowLeftIcon />
              <span className="sr-only">Back</span>
            </Button>
            <span className="line-clamp-1 max-w-60 text-sm font-medium">
              {selected?.title.trim() || t("common.untitled")}
            </span>
          </div>
          <div className="flex items-center gap-2 px-3" data-tour="sync-status">
            <SyncBadge userId={userId} />
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0 pb-28 md:pb-4">
          {selected ? (
            <NoteEditor
              key={selected.id}
              userId={userId}
              note={selected}
              noteId={selected.id}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Note not found on this device.</p>
          )}
        </div>
      </main>
    );
  }

  // ── Home view (mirrors MobileHome: brand, toggle, recent, created) ──
  const renderCard = (
    note: { id: string; title: string; content: string; tag: string | null; updated_at: string },
    variant: "grid" | "list"
  ) => {
    const isList = variant === "list";
    const excerpt = excerptFromHtml(note.content);
    return (
      <div
        key={note.id}
        role="button"
        tabIndex={0}
        onClick={() => openInline(note.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openInline(note.id);
          }
        }}
        className={cn(
          "group flex shadow-sm transition-colors hover:bg-muted/40 active:bg-muted select-none touch-manipulation rounded-xl border bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isList ? "flex-row items-center gap-3 p-3" : "flex-col gap-2 p-3.5"
        )}
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
                  <TagChip
                    tag={note.tag}
                    onClick={() => setTagFilter(note.tag)}
                    className="h-5 text-[11px]"
                  />
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
                <TagChip
                  tag={note.tag}
                  onClick={() => setTagFilter(note.tag)}
                  className="h-5 text-[11px]"
                />
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <main className="min-h-dvh flex flex-col bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 pt-4 pb-28 md:pb-4">
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            <span className="text-[1.75rem] font-bold tracking-tight leading-none">Bloc</span>
          </div>
          <SyncBadge userId={userId} />
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {tagFilter ? (
              <>
                <TagChip tag={tagFilter} className="h-6" />
                <button
                  type="button"
                  onClick={() => setTagFilter(null)}
                  className="shrink-0 text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
                >
                  Clear
                </button>
              </>
            ) : (
              pending > 0 && (
                <span className="truncate text-xs text-muted-foreground">
                  {pending} change{pending === 1 ? "" : "s"} queued — syncs on reconnect
                </span>
              )
            )}
          </div>
          <div
            role="group"
            aria-label={t("home.viewMode")}
            className="inline-flex shrink-0 items-center rounded-full border bg-muted p-1"
          >
            <button
              type="button"
              aria-label={t("home.gridView")}
              aria-pressed={view === "grid"}
              onClick={() => updateView("grid")}
              className={`flex size-7 items-center justify-center rounded-full transition-colors ${view === "grid" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <LayoutGridIcon className="size-4" />
            </button>
            <button
              type="button"
              aria-label={t("home.listView")}
              aria-pressed={view === "list"}
              onClick={() => updateView("list")}
              className={`flex size-7 items-center justify-center rounded-full transition-colors ${view === "list" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <ListIcon className="size-4" />
            </button>
          </div>
        </div>

        <section className="flex flex-col gap-3" data-tour="recent">
          <h2 className="text-sm font-semibold">{t("home.recent")}</h2>
          {recent.length > 0 ? (
            <div className={view === "grid" ? "grid grid-cols-2 gap-3" : "flex flex-col gap-2"}>
              {recent.map((note) => renderCard(note, view))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed bg-card p-6 text-center">
              <p className="text-sm text-muted-foreground">{t("home.noRecent")}</p>
              <Button type="button" size="sm" className="mt-3" onClick={handleCreate}>
                <PlusIcon className="size-3.5" />
                {t("home.createNote")}
              </Button>
            </div>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">{t("home.created")}</h2>
          {created.length > 0 ? (
            <div className={view === "grid" ? "grid grid-cols-2 gap-3" : "flex flex-col gap-2"}>
              {created.map((note) => renderCard(note, view))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed bg-card p-6 text-center">
              <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-muted">
                <FileTextIcon className="size-5 text-muted-foreground" />
              </div>
              <p className="mt-3 text-sm font-medium">{t("home.noNotesYet")}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("home.createFirstNoteDesc")}
              </p>
              <Button
                type="button"
                size="sm"
                className="mt-4"
                onClick={handleCreate}
                data-tour="create-note"
              >
                <PlusIcon className="size-3.5" />
                {t("home.newNote")}
              </Button>
            </div>
          )}
        </section>
      </div>

      {/* Mobile FAB (mirrors bottom-nav new-note button) */}
      <button
        type="button"
        aria-label={t("nav.newNote")}
        data-tour="create-note"
        onClick={handleCreate}
        className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition active:scale-95 fixed bottom-[calc(0.75rem+env(safe-area-inset-bottom))] right-4 z-40 md:hidden"
      >
        <PlusIcon className="size-6" />
      </button>
    </main>
  );
}
