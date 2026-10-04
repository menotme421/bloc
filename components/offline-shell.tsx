"use client";

import * as React from "react";
import {
  ArrowLeftIcon,
  EllipsisIcon,
  FileTextIcon,
  LayoutGridIcon,
  Library,
  ListIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  Trash2Icon,
} from "lucide-react";
import {
  EMPTY_NOTES,
  adoptOrphanedNotes,
  addOutboxEntry,
  addTombstone,
  clearLastNoteId,
  createLocalNote,
  getAllNotesSnapshot,
  getLastNoteId,
  getLocalNote,
  getLocalNotes,
  getNoteSnapshot,
  getOutbox,
  getRecentOpenedNotesSnapshot,
  markNoteOpened,
  removeLocalNote,
  removeOutboxEntry,
  removeTombstone,
  subscribeNotes,
  upsertLocalNote,
} from "@/lib/local-notes";
import { getOfflineAuth } from "@/lib/auth-state";
import { syncNote, syncPending } from "@/lib/note-sync";
import { getSyncStatus, subscribeSyncStatus } from "@/lib/note-status";
import { useResolvedUserId } from "@/lib/use-resolved-user-id";
import { useI18n } from "@/lib/i18n/provider";
import { NoteEditor } from "@/components/note-editor";
import { TagChip } from "@/components/tag-chip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FilterBar } from "@/components/note-filters";
import { BlocLogo } from "@/components/bloc-logo";
import { filterNotes, getUniqueTags, type DateFilter } from "@/lib/note-filters";
import { NavMain } from "@/components/nav-main";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarTrigger,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarInput,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarInset,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

// Offline shell. /offline is the one precached document, so after a kill +
// offline restart all CRUD happens here with zero navigation (a new
// /app/notes/<uuid> needs a server RSC fetch).
// Desktop copies the online app chrome exactly (same Sidebar/NavMain/row
// components structure, same header, same search layout). Mobile keeps the
// home card layout.

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

type CardNote = {
  id: string;
  title: string;
  content: string;
  tag: string | null;
  updated_at: string;
};

/* ── Sidebar note row: same visuals + same ••• menu as NoteSidebarItem,
   but opens inline (no navigation, which needs a server offline). ── */
function ShellNoteRow({
  userId,
  note,
  isActive,
  onOpen,
}: {
  userId: string;
  note: CardNote;
  isActive: boolean;
  onOpen: (id: string) => void;
}) {
  const [renaming, setRenaming] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [draft, setDraft] = React.useState(note.title);

  function commitRename() {
    setRenaming(false);
    const title = draft.trim();
    if (!title || title === note.title) return;
    const existing = getLocalNote(userId, note.id);
    if (!existing) return;
    const updated = { ...existing, title, updated_at: new Date().toISOString() };
    upsertLocalNote(userId, updated);
    addOutboxEntry(userId, { note: updated, mode: "update" });
    void syncNote(userId, updated, "update");
  }

  function handleDelete() {
    setDeleteOpen(false);
    removeLocalNote(userId, note.id);
    removeOutboxEntry(userId, note.id);
    addTombstone(userId, note.id);
    if (getLastNoteId(userId) === note.id) clearLastNoteId(userId);
    void syncPending(userId);
  }

  return (
    <SidebarMenuItem>
      {renaming ? (
        <SidebarMenuButton className="font-normal">
          <FileTextIcon />
          <SidebarInput
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
            className="h-6 px-1"
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") setRenaming(false);
            }}
            onBlur={commitRename}
          />
        </SidebarMenuButton>
      ) : (
        <SidebarMenuButton asChild isActive={isActive} className="font-normal">
          <button type="button" onClick={() => onOpen(note.id)}>
            <FileTextIcon />
            <span className="min-w-0 flex-1 truncate">
              {note.title.trim() || "Untitled"}
            </span>
            {note.tag && <TagChip tag={note.tag} className="h-5" />}
          </button>
        </SidebarMenuButton>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction showOnHover aria-label="Note actions">
            <EllipsisIcon />
          </SidebarMenuAction>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start">
          <DropdownMenuItem
            onSelect={() => {
              setDraft(note.title);
              setRenaming(true);
            }}
          >
            <PencilIcon />
            Rename
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
            <Trash2Icon />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete note?</DialogTitle>
            <DialogDescription>
              &quot;{note.title.trim() || "Untitled"}&quot; will be permanently
              deleted. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarMenuItem>
  );
}

const RECENT_LIMIT = 5;

export function OfflineShell() {
  const userId = useResolvedUserId("");
  const { t } = useI18n();
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [desktopView, setDesktopView] = React.useState<"home" | "search">("home");
  const [view, setView] = React.useState<"grid" | "list">("grid");
  const [tagFilter, setTagFilter] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [dateFilter, setDateFilter] = React.useState<DateFilter>("all");
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

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
    () => (userId ? getRecentOpenedNotesSnapshot(userId, RECENT_LIMIT) : EMPTY_NOTES),
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

  const currentNote = React.useSyncExternalStore(
    subscribeNotes,
    // eslint-disable-next-line react-hooks/incompatible-library
    () => (userId && selectedId ? getNoteSnapshot(userId, selectedId) : null),
    () => null
  );

  const relatedNotes = React.useMemo(() => {
    const tag = currentNote?.tag;
    if (!tag || !selectedId) return [];
    return allNotes.filter((note) => note.id !== selectedId && note.tag === tag);
  }, [currentNote, selectedId, allNotes]);

  const tags = React.useMemo(() => getUniqueTags(allNotes), [allNotes]);
  const hasActiveFilter =
    query.trim().length > 0 || dateFilter !== "all" || tagFilter !== null;
  const searchResults = React.useMemo(() => {
    if (!hasActiveFilter) return [];
    return filterNotes(allNotes, query, dateFilter, tagFilter);
  }, [allNotes, query, dateFilter, tagFilter, hasActiveFilter]);

  React.useEffect(() => {
    if (userId) {
      adoptOrphanedNotes(userId);
      // Seed local cache from any previously stored server snapshot is not
      // possible offline; locals are the source of truth here.
      void getLocalNotes(userId);
    }
  }, [userId]);

  React.useEffect(() => {
    if (!userId) return;
    const onOnline = () => void syncPending(userId);
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [userId]);

  React.useEffect(() => {
    setConfirmDelete(false);
  }, [selectedId]);

  const pending = userId ? getOutbox(userId).length : 0;
  const selected = currentNote;

  function handleCreate() {
    if (!userId) return;
    const note = createLocalNote(userId);
    markNoteOpened(userId, note.id);
    setSelectedId(note.id);
    setDesktopView("home");
  }

  function handleDelete(id: string) {
    if (!userId) return;
    removeLocalNote(userId, id);
    removeOutboxEntry(userId, id);
    addTombstone(userId, id);
    if (getLastNoteId(userId) === id) clearLastNoteId(userId);
    if (selectedId === id) setSelectedId(null);
    void syncPending(userId);
  }

  function openInline(id: string) {
    if (!userId) return;
    markNoteOpened(userId, id);
    setSelectedId(id);
  }

  function goHome() {
    setSelectedId(null);
    setDesktopView("home");
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

  /* Mobile card (same as app home cards; opens inline, no navigation). */
  const renderCard = (note: CardNote, variant: "grid" | "list") => {
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

  const viewToggle = (
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
  );

  /* ── Mobile home (unchanged, approved) ── */
  const mobileHome = (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 pt-4 pb-28 md:hidden">
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <BlocLogo size={28} />
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
        {viewToggle}
      </div>

      <section className="flex flex-col gap-3" data-tour="recent">
        <h2 className="text-sm font-semibold">{t("home.recent")}</h2>
        {recent.length > 0 ? (
          <div className={view === "grid" ? "grid grid-cols-2 gap-3" : "flex flex-col gap-2"}>
            {recent
              .filter((n) => (tagFilter ? n.tag === tagFilter : true))
              .map((note) => renderCard(note, view))}
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

      <button
        type="button"
        aria-label={t("nav.newNote")}
        data-tour="create-note"
        onClick={handleCreate}
        className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition active:scale-95 fixed bottom-[calc(0.75rem+env(safe-area-inset-bottom))] right-4 z-40 md:hidden"
      >
        <PlusIcon className="size-6" />
      </button>
    </div>
  );

  /* ── Desktop sidebar: same structure/classes as AppSidebar ── */
  const desktopSidebar = (
    <Sidebar className="border-r-0">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <BlocLogo size={28} />
          <span className="truncate text-[1.75rem] font-bold tracking-tight leading-none">
            Bloc
          </span>
        </div>
        <NavMain
          items={[
            {
              title: t("sidebar.search"),
              icon: <Library />,
              onSelect: () => {
                setSelectedId(null);
                setDesktopView("search");
              },
              tourId: "search",
            },
            {
              title: t("sidebar.createNote"),
              icon: <PlusIcon />,
              onSelect: handleCreate,
              tourId: "create-note",
            },
          ]}
        />
      </SidebarHeader>
      <SidebarContent className="px-2">
        <SidebarGroup className="p-0" data-tour="recent">
          <SidebarGroupLabel className="h-6">{t("sidebar.recent")}</SidebarGroupLabel>
          <SidebarGroupContent>
            {recent.length > 0 ? (
              <SidebarMenu className="gap-0.5">
                {recent.map((note) => (
                  <ShellNoteRow
                    key={note.id}
                    userId={userId}
                    note={note}
                    isActive={selectedId === note.id}
                    onOpen={openInline}
                  />
                ))}
              </SidebarMenu>
            ) : (
              <p className="px-2 py-1.5 text-xs text-muted-foreground">
                {t("sidebar.noNotesYet")}
              </p>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
        {currentNote?.tag && (
          <>
            <Separator className="my-3" />
            <SidebarGroup className="p-0">
              <SidebarGroupLabel className="h-6 gap-1.5">
                {t("sidebar.notesWith")}
                <TagChip tag={currentNote.tag} className="h-5" />
              </SidebarGroupLabel>
              <SidebarGroupContent>
                {relatedNotes.length > 0 ? (
                  <SidebarMenu className="gap-0.5">
                    {relatedNotes.map((note) => (
                      <ShellNoteRow
                        key={note.id}
                        userId={userId}
                        note={note}
                        isActive={selectedId === note.id}
                        onOpen={openInline}
                      />
                    ))}
                  </SidebarMenu>
                ) : (
                  <p className="px-2 py-1.5 text-xs text-muted-foreground">
                    {t("sidebar.noOtherWithTag")}
                  </p>
                )}
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center gap-2 rounded-md px-2 py-1.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
            U
          </span>
          <span className="min-w-0 flex-1 truncate text-sm">User</span>
          <SyncBadge userId={userId} />
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );

  /* ── Desktop search view: same layout as SearchPage ── */
  const desktopSearch = (
    <div className="flex flex-col gap-4 pb-28">
      <h1 className="text-xl font-bold tracking-tight">{t("search.title")}</h1>
      <div className="flex items-center gap-2" data-tour="search">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("search.placeholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-10 pl-9"
          />
        </div>
        <Button
          type="button"
          variant={filtersOpen ? "secondary" : "outline"}
          size="icon"
          onClick={() => setFiltersOpen((v) => !v)}
          aria-label={t("search.toggleFilters")}
          className="size-10 shrink-0"
        >
          <SlidersHorizontalIcon className="size-4" />
        </Button>
      </div>
      {filtersOpen && (
        <div className="rounded-xl border bg-card p-4">
          <FilterBar
            dateValue={dateFilter}
            onDateChange={setDateFilter}
            tagValue={tagFilter}
            onTagChange={setTagFilter}
            tags={tags}
            onClear={() => {
              setQuery("");
              setDateFilter("all");
              setTagFilter(null);
            }}
            hasActive={hasActiveFilter}
          />
        </div>
      )}
      {!hasActiveFilter ? (
        <div className="rounded-xl border border-dashed bg-card p-8 text-center">
          <SearchIcon className="mx-auto size-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm font-medium">{t("search.searchYourNotes")}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("search.searchYourNotesDesc")}
          </p>
        </div>
      ) : searchResults.length > 0 ? (
        <>
          <p className="text-xs text-muted-foreground">
            {searchResults.length}{" "}
            {searchResults.length === 1 ? t("search.result") : t("search.results")}
          </p>
          <div className="grid grid-cols-2 gap-3">
            {searchResults.map((note) => renderCard(note, "grid"))}
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-dashed bg-card p-8 text-center">
          <SearchIcon className="mx-auto size-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm font-medium">{t("search.noNotesFound")}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("search.noResultsFor", { query: query.trim() })}
          </p>
        </div>
      )}
    </div>
  );

  /* ── Desktop home main: same as DesktopHomeFallback, opens inline ── */
  const desktopHome = (
    <div className="hidden md:flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
      <p className="text-sm text-muted-foreground">{t("home.desktopFallbackTitle")}</p>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          const last = userId ? getLastNoteId(userId) : null;
          if (last && getLocalNote(userId, last)) openInline(last);
          else if (recent.length > 0) openInline(recent[0].id);
          else handleCreate();
        }}
      >
        {t("home.goToLastNote")}
      </Button>
    </div>
  );

  /* ── Desktop note header: same bar as AppHeader note section ── */
  const desktopNoteHeader = (
    <header className="flex h-14 shrink-0 items-center gap-2">
      <div className="flex flex-1 items-center gap-2 px-3">
        <SidebarTrigger className="max-md:hidden" />
        <Separator orientation="vertical" className="mr-2 max-md:hidden data-vertical:h-4 data-vertical:self-auto" />
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Back to home"
          onClick={goHome}
          className="md:hidden"
        >
          <ArrowLeftIcon />
          <span className="sr-only">Back</span>
        </Button>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage className="line-clamp-1 max-w-60 md:max-w-120">
                {selected && selected.title.trim()
                  ? selected.title
                  : t("header.untitled")}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <div className="flex items-center gap-2 px-3" data-tour="sync-status">
        <SyncBadge userId={userId} />
        {confirmDelete ? (
          <>
            <Button
              variant="destructive"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => selectedId && handleDelete(selectedId)}
            >
              Confirm?
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setConfirmDelete(false)}
            >
              Keep
            </Button>
          </>
        ) : (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Delete note"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2Icon className="size-4" />
            <span className="sr-only">Delete</span>
          </Button>
        )}
      </div>
    </header>
  );

  /* ── Editor view ── */
  if (selectedId) {
    return (
      <SidebarProvider>
        <div className="flex min-h-dvh w-full bg-background text-foreground">
          <div className="hidden md:contents">{desktopSidebar}</div>
          <SidebarInset>
            {desktopNoteHeader}
            <div className="flex flex-1 flex-col gap-4 p-4 pt-0 pb-28 md:pb-4">
              {selected ? (
                <NoteEditor
                  key={selected.id}
                  userId={userId}
                  note={selected}
                  noteId={selected.id}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Note not found on this device.
                </p>
              )}
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    );
  }

  /* ── Home / search view ── */
  return (
    <SidebarProvider>
      <div className="flex min-h-dvh w-full bg-background text-foreground">
        <div className="hidden md:contents">{desktopSidebar}</div>
        <SidebarInset>
          <div className="hidden flex-1 flex-col gap-4 p-4 pt-0 pb-28 md:flex md:pb-4">
            {desktopView === "search" ? (
              desktopSearch
            ) : (
              <>
                {desktopHome}
                {pending > 0 && (
                  <p className="text-center text-xs text-muted-foreground">
                    {pending} change{pending === 1 ? "" : "s"} queued — syncs on
                    reconnect
                  </p>
                )}
              </>
            )}
          </div>
          <div className="md:hidden">{mobileHome}</div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
