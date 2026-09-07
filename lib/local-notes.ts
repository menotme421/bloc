import type { Note } from "@/lib/notes";

const STORAGE_PREFIX = "bloc:notes:";
const OUTBOX_SUFFIX = ":outbox";
const DELETED_SUFFIX = ":deleted";
const LAST_SUFFIX = ":last";
const RECENT_SUFFIX = ":recent";
const RECENT_OPENED_CAP = 50;

const NOTES_UPDATED_EVENT = "bloc:notes:updated";

export type OutboxEntry = {
  note: Note;
  mode: "create" | "update";
};

let notesVersion = 0;
const notesListeners = new Set<() => void>();

export function subscribeNotes(listener: () => void) {
  notesListeners.add(listener);
  return () => {
    notesListeners.delete(listener);
  };
}

function notifyUpdated() {
  notesVersion++;
  notesListeners.forEach((listener) => listener());
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(NOTES_UPDATED_EVENT));
  }
}

export const EMPTY_NOTES: Note[] = [];

let noteCache: { userId: string; id: string; version: number; note: Note | null } = {
  userId: "",
  id: "",
  version: -1,
  note: null,
};

let allNotesCache: { userId: string; version: number; notes: Note[] } = {
  userId: "",
  version: -1,
  notes: EMPTY_NOTES,
};

let recentOpenedCache: {
  userId: string;
  limit: number;
  version: number;
  notes: Note[];
} = {
  userId: "",
  limit: 0,
  version: -1,
  notes: EMPTY_NOTES,
};

export function getAllNotesSnapshot(userId: string): Note[] {
  if (
    allNotesCache.userId !== userId ||
    allNotesCache.version !== notesVersion
  ) {
    allNotesCache = {
      userId,
      version: notesVersion,
      notes: getLocalNotes(userId).sort(
        (a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at)
      ),
    };
  }
  return allNotesCache.notes;
}

export function getRecentOpenedNotesSnapshot(
  userId: string,
  limit = 5
): Note[] {
  if (
    recentOpenedCache.userId !== userId ||
    recentOpenedCache.limit !== limit ||
    recentOpenedCache.version !== notesVersion
  ) {
    const notesById = new Map(getLocalNotes(userId).map((n) => [n.id, n]));
    const ids = getRecentOpenedIds(userId);
    let ordered: Note[];
    if (ids.length > 0) {
      ordered = ids
        .map((id) => notesById.get(id))
        .filter((n): n is Note => n !== undefined);
    } else {
      ordered = [...notesById.values()].sort(
        (a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at)
      );
    }
    recentOpenedCache = {
      userId,
      limit,
      version: notesVersion,
      notes: ordered.slice(0, limit),
    };
  }
  return recentOpenedCache.notes;
}

export function getNoteSnapshot(
  userId: string,
  id: string
): Note | null {
  if (
    noteCache.userId !== userId ||
    noteCache.id !== id ||
    noteCache.version !== notesVersion
  ) {
    noteCache = {
      userId,
      id,
      version: notesVersion,
      note: getLocalNote(userId, id),
    };
  }
  return noteCache.note;
}

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}${userId}`;
}

function outboxKey(userId: string) {
  return `${storageKey(userId)}${OUTBOX_SUFFIX}`;
}

function deletedKey(userId: string) {
  return `${storageKey(userId)}${DELETED_SUFFIX}`;
}

function lastKey(userId: string) {
  return `${storageKey(userId)}${LAST_SUFFIX}`;
}

function parse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (e) {
    if (e instanceof DOMException && e.name === "QuotaExceededError") {
      console.error("[localStorage] Storage full. Key:", key);
    } else {
      console.error("[localStorage] Write failed. Key:", key, e);
    }
    return false;
  }
}

/* ── Note cache ──────────────────────────────────────────── */

export function getLocalNotes(userId: string): Note[] {
  if (typeof window === "undefined") return [];

  const parsed = parse<Note[]>(window.localStorage.getItem(storageKey(userId)));
  const notes = Array.isArray(parsed) ? parsed : [];
  if (notes.some((n) => n.tag === undefined)) {
    return notes.map((n) => ({ ...n, tag: n.tag ?? null }));
  }
  return notes;
}

export function setLocalNotes(userId: string, notes: Note[]) {
  if (typeof window === "undefined") return;

  safeSetItem(storageKey(userId), JSON.stringify(notes));
}

export function getLocalNote(userId: string, id: string): Note | null {
  return getLocalNotes(userId).find((n) => n.id === id) ?? null;
}

export function upsertLocalNote(userId: string, note: Note, silent = false) {
  const notes = getLocalNotes(userId);
  const index = notes.findIndex((n) => n.id === note.id);
  if (index >= 0) {
    const existing = notes[index];
    if (
      existing.title === note.title &&
      existing.content === note.content &&
      existing.tag === note.tag &&
      existing.updated_at === note.updated_at
    ) {
      return;
    }
    notes[index] = note;
  } else {
    notes.unshift(note);
  }
  setLocalNotes(userId, notes);
  if (!silent) notifyUpdated();
}

export function removeLocalNote(userId: string, id: string) {
  setLocalNotes(
    userId,
    getLocalNotes(userId).filter((n) => n.id !== id)
  );
  notifyUpdated();
}

function genNoteId(): string {
  try {
    if (typeof globalThis !== "undefined" && globalThis.crypto?.randomUUID) {
      return globalThis.crypto.randomUUID();
    }
  } catch {}
  // Fallback: generate a valid UUID v4 using getRandomValues
  if (typeof globalThis !== "undefined" && globalThis.crypto?.getRandomValues) {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  // Last resort: still format as UUID-like to pass zod validation loosely
  // (this should rarely happen in modern browsers)
  return "00000000-0000-4000-8000-000000000000";
}

export function createLocalNote(
  userId: string,
  title = "",
  content = ""
): Note {
  if (!userId) {
    throw new Error("[local-notes] createLocalNote called with empty userId — resolve offline auth first.");
  }
  const now = new Date().toISOString();
  const note: Note = {
    id: genNoteId(),
    title,
    content,
    tag: null,
    created_at: now,
    updated_at: now,
  };
  upsertLocalNote(userId, note);
  addOutboxEntry(userId, { note, mode: "create" });
  return note;
}

/* ── Orphan adoption (empty-userId bucket) ─────────────────── */
/* Notes created before offline auth resolves may land under "".
   Move them (plus outbox/tombstones/recent/last) to the real uid once
   known. Single-device assumption: merge, dedupe by id. */

export function adoptOrphanedNotes(userId: string) {
  if (typeof window === "undefined" || !userId) return;
  const orphanKey = storageKey("");
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(orphanKey);
  } catch {
    return;
  }
  if (!raw) return;
  let orphans: Note[] = [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) orphans = parsed as Note[];
  } catch {
    return;
  }
  if (orphans.length === 0) {
    try {
      window.localStorage.removeItem(orphanKey);
    } catch {}
    return;
  }
  const existing = new Map(getLocalNotes(userId).map((n) => [n.id, n]));
  for (const n of orphans) {
    if (!existing.has(n.id)) existing.set(n.id, n);
  }
  setLocalNotes(userId, [...existing.values()]);
  // Move outbox entries too
  try {
    const orphanOutbox = parse<OutboxEntry[]>(window.localStorage.getItem(outboxKey("")));
    if (Array.isArray(orphanOutbox) && orphanOutbox.length > 0) {
      const current = getOutbox(userId);
      const seen = new Set(current.map((e) => e.note.id));
      for (const e of orphanOutbox) {
        if (!seen.has(e.note.id)) {
          current.push(e);
          seen.add(e.note.id);
        }
      }
      setOutbox(userId, current);
    }
    const orphanDeleted = parse<string[]>(window.localStorage.getItem(deletedKey("")));
    if (Array.isArray(orphanDeleted) && orphanDeleted.length > 0) {
      const current = new Set(getTombstones(userId));
      for (const id of orphanDeleted) current.add(id);
      setTombstones(userId, [...current]);
    }
    const orphanLast = window.localStorage.getItem(lastKey(""));
    if (orphanLast && !getLastNoteId(userId)) setLastNoteId(userId, orphanLast);
    const orphanRecent = parse<string[]>(window.localStorage.getItem(recentKey("")));
    if (Array.isArray(orphanRecent) && orphanRecent.length > 0) {
      const current = getRecentOpenedIds(userId);
      const merged = [...orphanRecent.filter((id) => !current.includes(id)), ...current];
      setRecentOpenedIds(userId, merged.slice(0, RECENT_OPENED_CAP));
    }
  } catch {}
  try {
    window.localStorage.removeItem(orphanKey);
    window.localStorage.removeItem(outboxKey(""));
    window.localStorage.removeItem(deletedKey(""));
    window.localStorage.removeItem(lastKey(""));
    window.localStorage.removeItem(recentKey(""));
  } catch {}
  notifyUpdated();
}

/* ── Outbox (unsynced changes) ───────────────────────────── */

export function getOutbox(userId: string): OutboxEntry[] {
  if (typeof window === "undefined") return [];

  const parsed = parse<OutboxEntry[]>(
    window.localStorage.getItem(outboxKey(userId))
  );
  return Array.isArray(parsed) ? parsed : [];
}

function setOutbox(userId: string, entries: OutboxEntry[]) {
  if (typeof window === "undefined") return;

  safeSetItem(outboxKey(userId), JSON.stringify(entries));
}

export function addOutboxEntry(userId: string, entry: OutboxEntry) {
  const entries = getOutbox(userId).filter((e) => e.note.id !== entry.note.id);
  entries.push(entry);
  setOutbox(userId, entries);
}

export function removeOutboxEntry(userId: string, id: string) {
  setOutbox(
    userId,
    getOutbox(userId).filter((e) => e.note.id !== id)
  );
}

export function isInOutbox(userId: string, id: string) {
  return getOutbox(userId).some((e) => e.note.id === id);
}

/* ── Tombstones (queued deletes) ─────────────────────────── */

export function getTombstones(userId: string): string[] {
  if (typeof window === "undefined") return [];

  const parsed = parse<string[]>(window.localStorage.getItem(deletedKey(userId)));
  return Array.isArray(parsed) ? parsed : [];
}

function setTombstones(userId: string, ids: string[]) {
  if (typeof window === "undefined") return;

  safeSetItem(deletedKey(userId), JSON.stringify(ids));
}

export function addTombstone(userId: string, id: string) {
  const ids = getTombstones(userId);
  if (!ids.includes(id)) {
    setTombstones(userId, [...ids, id]);
  }
}

export function removeTombstone(userId: string, id: string) {
  setTombstones(
    userId,
    getTombstones(userId).filter((t) => t !== id)
  );
}

/* ── Last opened note ────────────────────────────────────── */

export function getLastNoteId(userId: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(lastKey(userId));
}

export function setLastNoteId(userId: string, id: string) {
  if (typeof window === "undefined") return;
  safeSetItem(lastKey(userId), id);
}

export function clearLastNoteId(userId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(lastKey(userId));
  } catch {}
}

/* ── Recently opened notes ────────────────────────────────── */
/* Independently tracks note opens (max RECENT_OPENED_CAP).    */
/* The Recent section uses this ordering and is never filtered */
/* by the active tag.                                         */

function recentKey(userId: string) {
  return `${storageKey(userId)}${RECENT_SUFFIX}`;
}

export function getRecentOpenedIds(userId: string): string[] {
  if (typeof window === "undefined") return [];
  const parsed = parse<string[]>(
    window.localStorage.getItem(recentKey(userId))
  );
  return Array.isArray(parsed) ? parsed : [];
}

function setRecentOpenedIds(userId: string, ids: string[]) {
  if (typeof window === "undefined") return;
  safeSetItem(recentKey(userId), JSON.stringify(ids));
}

export function markNoteOpened(userId: string, id: string) {
  if (typeof window === "undefined") return;
  setLastNoteId(userId, id);
  const ids = getRecentOpenedIds(userId).filter((x) => x !== id);
  ids.unshift(id);
  setRecentOpenedIds(userId, ids.slice(0, RECENT_OPENED_CAP));
  notifyUpdated();
}