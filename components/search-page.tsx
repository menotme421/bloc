"use client";

import * as React from "react";
import Link from "next/link";
import { SearchIcon, SlidersHorizontalIcon, CircleHelpIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { MobileNoteCard } from "@/components/mobile-note-card";
import { FilterBar } from "@/components/note-filters";
import {
  EMPTY_NOTES,
  getAllNotesSnapshot,
  subscribeNotes,
} from "@/lib/local-notes";
import { filterNotes, getUniqueTags, type DateFilter } from "@/lib/note-filters";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/provider";
import { useSearchParams, useRouter } from "next/navigation";
import { useResolvedUserId } from "@/lib/use-resolved-user-id";
import { DOCS } from "@/lib/docs";

export function SearchPage({ userId: userIdProp }: { userId: string }) {
  const { t } = useI18n();
  const userId = useResolvedUserId(userIdProp);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = React.useState("");
  const [dateFilter, setDateFilter] = React.useState<DateFilter>("all");
  const [tagFilter, setTagFilter] = React.useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = React.useState(false);

  React.useEffect(() => {
    const tag = searchParams.get("tag");
    if (tag) {
      setTagFilter(tag);
      setFiltersOpen(true);
    }
  }, [searchParams]);

  const allNotes = React.useSyncExternalStore(
    subscribeNotes,
    () => getAllNotesSnapshot(userId),
    () => EMPTY_NOTES
  );

  const tags = React.useMemo(() => getUniqueTags(allNotes), [allNotes]);

  const hasQuery = query.trim().length > 0;
  const hasActiveFilter = hasQuery || dateFilter !== "all" || tagFilter !== null;

  const filtered = React.useMemo(() => {
    if (!hasActiveFilter) return [];
    return filterNotes(allNotes, query, dateFilter, tagFilter);
  }, [allNotes, query, dateFilter, tagFilter, hasActiveFilter]);

  const hasActive = hasActiveFilter;

  function clearAll() {
    setQuery("");
    setDateFilter("all");
    setTagFilter(null);
    router.replace("/app/search");
  }

  function handleTagChange(tag: string | null) {
    setTagFilter(tag);
    if (tag) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tag", tag);
      router.replace(`/app/search?${params.toString()}`);
    } else {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("tag");
      const qs = params.toString();
      router.replace(qs ? `/app/search?${qs}` : "/app/search");
    }
  }

  return (
    <div className="flex flex-col gap-4 pb-28">
      {/* Header same as home: branding */}
      <div className="flex items-center justify-between pt-2">
        <span className="text-[1.75rem] font-bold tracking-tight leading-none">Bloc</span>
        <Link
          href="/app/help"
          aria-label={t("help.menuLabel")}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <CircleHelpIcon className="size-5" />
        </Link>
      </div>

      <h1 className="text-xl font-bold tracking-tight">{t("search.title")}</h1>

      {/* Search bar + filter toggle */}
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

      {/* Filters collapsible */}
      {filtersOpen && (
        <div className="rounded-xl border bg-card p-4">
          <FilterBar
            dateValue={dateFilter}
            onDateChange={setDateFilter}
            tagValue={tagFilter}
            onTagChange={handleTagChange}
            tags={tags}
            onClear={clearAll}
            hasActive={hasActive}
          />
        </div>
      )}

      {/* Inline active chips when filters collapsed but active */}
      {!filtersOpen && hasActive && (
        <div className="flex flex-wrap items-center gap-2">
          {query && (
            <span className="rounded-full bg-muted px-3 py-1 text-xs">
              “{query}”
            </span>
          )}
          {dateFilter !== "all" && (
            <span className="rounded-full bg-muted px-3 py-1 text-xs capitalize">
              {t(`search.${dateFilter}`)}
            </span>
          )}
          {tagFilter && (
            <span className="rounded-full bg-muted px-3 py-1 text-xs">
              #{tagFilter}
            </span>
          )}
          <button
            type="button"
            onClick={clearAll}
            className="text-xs font-medium text-primary hover:underline"
          >
            {t("common.clear")}
          </button>
        </div>
      )}

      {/* Results */}
      {!hasActive ? (
        <div className="rounded-xl border border-dashed bg-card p-8 text-center">
          <SearchIcon className="mx-auto size-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm font-medium">{t("search.searchYourNotes")}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("search.searchYourNotesDesc")}
          </p>
          <a
            href={DOCS.search}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-xs font-medium text-primary hover:underline"
          >
            {t("help.docs")} →
          </a>
        </div>
      ) : filtered.length > 0 ? (
        <>
          <p className="text-xs text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? t("search.result") : t("search.results")}
          </p>
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((note) => (
              <MobileNoteCard key={note.id} userId={userId} note={note} />
            ))}
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-dashed bg-card p-8 text-center">
          <SearchIcon className="mx-auto size-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm font-medium">{t("search.noNotesFound")}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("search.noResultsFor", { query: query.trim() })}
          </p>
          {hasActive && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={clearAll}
            >
              {t("search.clearFilters")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
