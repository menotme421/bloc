"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { HomeIcon, SearchIcon, PlusIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { createLocalNote, markNoteOpened } from "@/lib/local-notes";
import { useI18n } from "@/lib/i18n/provider";
import { useResolvedUserId } from "@/lib/use-resolved-user-id";

export function MobileBottomNav({ userId: userIdProp }: { userId: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const userId = useResolvedUserId(userIdProp);

  const isHome = pathname === "/app/home";
  const isSearch = pathname === "/app/search";
  const isNotePage = pathname.startsWith("/app/notes/");

  if (isNotePage) return null;

  function handleCreateNote() {
    if (!userId) return;
    const note = createLocalNote(userId);
    markNoteOpened(userId, note.id);
    router.push(`/app/notes/${note.id}`);
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-2 sm:px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:hidden">
      <div className="pointer-events-auto flex w-full max-w-md items-center gap-1.5 sm:gap-2">
        {/* grouped pill: Home + Search — matched to FAB height (56px) */}
        <div className="flex flex-1 items-center gap-1 rounded-full border bg-card/95 p-2.5 shadow-lg backdrop-blur min-h-14">
          <Link
            href="/app/home"
            replace
            aria-label={t("nav.home")}
            className={cn(
              "inline-flex flex-1 min-w-0 items-center justify-center gap-1.5 rounded-full px-2 py-3 text-xs font-medium whitespace-nowrap overflow-hidden transition-colors",
              isHome
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <HomeIcon className="size-4 shrink-0" />
            <span className="truncate whitespace-nowrap">{t("nav.home")}</span>
          </Link>
          <Link
            href="/app/search"
            replace
            aria-label={t("nav.search")}
            className={cn(
              "inline-flex flex-1 min-w-0 items-center justify-center gap-1.5 rounded-full px-2 py-3 text-xs font-medium whitespace-nowrap overflow-hidden transition-colors",
              isSearch
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <SearchIcon className="size-4 shrink-0" />
            <span className="truncate whitespace-nowrap">{t("nav.search")}</span>
          </Link>
        </div>

        {/* isolated circular new note button — close gap (2 = 8px) */}
        <button
          type="button"
          aria-label={t("nav.newNote")}
          onClick={handleCreateNote}
          className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition active:scale-95"
        >
          <PlusIcon className="size-6" />
        </button>
      </div>
    </div>
  );
}
