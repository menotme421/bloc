"use client";

import * as React from "react";
import { SearchIcon, SlidersHorizontalIcon } from "lucide-react";
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

export function SearchPage({ userId }: { userId: string }) {
  const { t } = useI18n();
  const [query, setQuery] = React.useState("");
  const [dateFilter, setDateFilter] = React.useState<DateFilter>("all");
  const [tagFilter, setTagFilter] = React.useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = React.useState(false);

  const allNotes = React.useSyncExternalStore(
    subscribeNotes,
    () => getAllNotesSnapshot(userId),
    () => EMPTY_NOTES
  );

  const tags = React.useMemo(() => getUniqueTags(allNotes), [allNotes]);

  const hasQuery = query.trim().length > 0;

  const filtered = React.useMemo(() => {
    if (!hasQuery) return [];
    return filterNotes(allNotes, query, dateFilter, tagFilter);
  }, [allNotes, query, dateFilter, tagFilter, hasQuery]);

  const hasActive =
    dateFilter !== "all" || tagFilter !== null || hasQuery;

  function clearAll() {
    setQuery("");
    setDateFilter("all");
    setTagFilter(null);
  }

  return (
    <div className="flex flex-col gap-4 pb-28">
      {/* Header same as home: branding */}
      <div className="flex items-center gap-2 pt-2">
        <span className="text-[1.75rem] font-bold tracking-tight leading-none">Bloc</span>
      </div>

      <h1 className="text-xl font-bold tracking-tight">{t("search.title")}</h1>

      {/* Search bar + filter toggle */}
      <div className="flex items-center gap-2">
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
            onTagChange={setTagFilter}
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
      {!hasQuery ? (
        <div className="rounded-xl border border-dashed bg-card p-8 text-center">
          <SearchIcon className="mx-auto size-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm font-medium">{t("search.searchYourNotes")}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("search.searchYourNotesDesc")}
          </p>
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
