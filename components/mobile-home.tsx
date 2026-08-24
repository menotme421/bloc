"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PlusIcon, FileTextIcon, LayoutGridIcon, ListIcon } from "lucide-react";
import {
  EMPTY_NOTES,
  getAllNotesSnapshot,
  getRecentOpenedNotesSnapshot,
  subscribeNotes,
  createLocalNote,
  markNoteOpened,
} from "@/lib/local-notes";
import { MobileNoteCard } from "@/components/mobile-note-card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import ProfileAvatar from "@/components/profile-avatar";
import { useI18n } from "@/lib/i18n/provider";

export function MobileHome({
  userId,
  user,
}: {
  userId: string;
  user?: { name: string; avatar: string | null };
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [view, setView] = React.useState<"grid" | "list">("grid");

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
    () => getRecentOpenedNotesSnapshot(userId, 5),
    () => EMPTY_NOTES
  );

  const allNotes = React.useSyncExternalStore(
    subscribeNotes,
    () => getAllNotesSnapshot(userId),
    () => EMPTY_NOTES
  );

  // Created: sorted by created_at DESC, vertical scroll, all notes
  const created = React.useMemo(() => {
    return [...allNotes].sort(
      (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)
    );
  }, [allNotes]);

  function handleCreateNote() {
    const note = createLocalNote(userId);
    markNoteOpened(userId, note.id);
    router.push(`/app/notes/${note.id}`);
  }

  return (
    <div className="flex flex-col gap-6 pb-28 md:hidden">
      {/* Branding header - home only with profile placeholder */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <span className="text-[1.75rem] font-bold tracking-tight leading-none">Bloc</span>
        </div>
        <Link
          href="/app/profile"
          aria-label="Profile"
          className="shrink-0 rounded-full ring-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Avatar className="size-8 rounded-full border">
            <AvatarImage
              src={user?.avatar ?? undefined}
              alt={user?.name ?? "Profile"}
            />
            <ProfileAvatar name={user?.name ?? "User"} size={32} />
          </Avatar>
        </Link>
      </div>

      {/* View toggle — grid / list */}
      <div className="flex justify-end">
        <div
          role="group"
          aria-label={t("home.viewMode")}
          className="inline-flex items-center rounded-full border bg-muted p-1"
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

      {/* Recent section */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">{t("home.recent")}</h2>
        {recent.length > 0 ? (
          <div className={view === "grid" ? "grid grid-cols-2 gap-3" : "flex flex-col gap-2"}>
            {recent.map((note) => (
              <MobileNoteCard key={note.id} userId={userId} note={note} variant={view} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">{t("home.noRecent")}</p>
            <Button
              type="button"
              size="sm"
              className="mt-3"
              onClick={handleCreateNote}
            >
              <PlusIcon />
              {t("home.createNote")}
            </Button>
          </div>
        )}
      </section>

      {/* Created section: all notes sorted newly created */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">{t("home.created")}</h2>
        {created.length > 0 ? (
          <div className={view === "grid" ? "grid grid-cols-2 gap-3" : "flex flex-col gap-2"}>
            {created.map((note) => (
              <MobileNoteCard key={note.id} userId={userId} note={note} variant={view} />
            ))}
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
              onClick={handleCreateNote}
            >
              <PlusIcon />
              {t("home.newNote")}
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}

// Desktop placeholder so /app/home still renders something useful on large screens
export function DesktopHomeFallback() {
  const { t } = useI18n();
  return (
    <div className="hidden md:flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
      <p className="text-sm text-muted-foreground">
        {t("home.desktopFallbackTitle")}
      </p>
      <Button asChild variant="outline" size="sm">
        <Link href="/app">{t("home.goToLastNote")}</Link>
      </Button>
    </div>
  );
}
