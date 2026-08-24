"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { DateFilter } from "@/lib/note-filters";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/provider";

const DATE_KEYS: Record<DateFilter, string> = {
  all: "search.all",
  today: "search.today",
  week: "search.week",
  month: "search.month",
  older: "search.older",
};

export function DateFilterChips({
  value,
  onChange,
}: {
  value: DateFilter;
  onChange: (v: DateFilter) => void;
}) {
  const { t } = useI18n();
  const options: { value: DateFilter; label: string }[] = (Object.keys(DATE_KEYS) as DateFilter[]).map((k) => ({
    value: k,
    label: t(DATE_KEYS[k]),
  }));
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            value === opt.value
              ? "border-foreground bg-foreground text-background"
              : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function TagFilterChips({
  tags,
  value,
  onChange,
}: {
  tags: string[];
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const { t } = useI18n();
  if (tags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        type="button"
        onClick={() => onChange(null)}
        className={cn(
          "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
          value === null
            ? "border-foreground bg-foreground text-background"
            : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        {t("search.allTags")}
      </button>
      {tags.map((tag) => (
        <button
          key={tag}
          type="button"
          onClick={() => onChange(tag)}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            value === tag
              ? "border-foreground bg-foreground text-background"
              : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          {tag}
        </button>
      ))}
    </div>
  );
}

export function FilterBar({
  dateValue,
  onDateChange,
  tagValue,
  onTagChange,
  tags,
  onClear,
  hasActive,
}: {
  dateValue: DateFilter;
  onDateChange: (v: DateFilter) => void;
  tagValue: string | null;
  onTagChange: (v: string | null) => void;
  tags: string[];
  onClear: () => void;
  hasActive: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{t("search.date")}</span>
        {hasActive && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={onClear}
            className="h-6 text-xs"
          >
            {t("common.clear")}
          </Button>
        )}
      </div>
      <DateFilterChips value={dateValue} onChange={onDateChange} />
      {tags.length > 0 && (
        <>
          <span className="text-xs font-medium text-muted-foreground">{t("search.tag")}</span>
          <TagFilterChips tags={tags} value={tagValue} onChange={onTagChange} />
        </>
      )}
    </div>
  );
}
