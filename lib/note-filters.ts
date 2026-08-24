"use client";

import type { Note } from "@/lib/notes";

export type DateFilter = "all" | "today" | "week" | "month" | "older";
export type TagFilter = string | null;

export function filterNotes(
  notes: Note[],
  query: string,
  dateFilter: DateFilter,
  tagFilter: TagFilter
): Note[] {
  const q = query.trim().toLowerCase();
  const now = Date.now();

  return notes.filter((note) => {
    // text query
    if (q) {
      const haystack = `${note.title} ${note.tag ?? ""}`.toLowerCase();
      // also search plain text from content stripped
      const text = note.content.replace(/<[^>]*>/g, "").toLowerCase();
      if (!haystack.includes(q) && !text.includes(q)) return false;
    }

    // tag filter
    if (tagFilter && note.tag !== tagFilter) return false;

    // date filter on updated_at
    if (dateFilter !== "all") {
      const t = Date.parse(note.updated_at);
      const diff = now - t;
      const day = 24 * 60 * 60 * 1000;
      if (dateFilter === "today" && diff > day) return false;
      if (dateFilter === "week" && diff > 7 * day) return false;
      if (dateFilter === "month" && diff > 30 * day) return false;
      if (dateFilter === "older" && diff <= 30 * day) return false;
    }

    return true;
  });
}

export function getUniqueTags(notes: Note[]): string[] {
  const set = new Set<string>();
  for (const n of notes) if (n.tag) set.add(n.tag);
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}
