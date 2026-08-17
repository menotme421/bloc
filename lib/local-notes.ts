import type { Note } from "@/lib/notes";

const STORAGE_PREFIX = "bloc:notes:";
const OUTBOX_SUFFIX = ":outbox";
const DELETED_SUFFIX = ":deleted";
const LAST_SUFFIX = ":last";

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

let recentCache: { userId: string; version: number; notes: Note[] } = {
  userId: "",
  version: -1,
  notes: EMPTY_NOTES,
};

let noteCache: { userId: string; id: string; version: number; note: Note | null } = {
  userId: "",
  id: "",
  version: -1,
  note: null,
};

export function getRecentNotesSnapshot(userId: string, limit = 8): Note[] {
  if (
    recentCache.userId !== userId ||
    recentCache.version !== notesVersion
  ) {
    recentCache = {
      userId,
      version: notesVersion,
      notes: getLocalNotes(userId)
        .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))
        .slice(0, limit),
    };
  }
  return recentCache.notes;
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

/* ── Note cache ──────────────────────────────────────────── */

export function getLocalNotes(userId: string): Note[] {
  if (typeof window === "undefined") return [];

  const parsed = parse<Note[]>(window.localStorage.getItem(storageKey(userId)));
  return Array.isArray(parsed) ? parsed : [];
}

export function setLocalNotes(userId: string, notes: Note[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(notes));
  } catch {}
}

export function getLocalNote(userId: string, id: string): Note | null {
  return getLocalNotes(userId).find((n) => n.id === id) ?? null;
}

export function upsertLocalNote(userId: string, note: Note) {
  const notes = getLocalNotes(userId);
  const index = notes.findIndex((n) => n.id === note.id);
  if (index >= 0) {
    notes[index] = note;
  } else {
    notes.unshift(note);
  }
  setLocalNotes(userId, notes);
  notifyUpdated();
}

export function removeLocalNote(userId: string, id: string) {
  setLocalNotes(
    userId,
    getLocalNotes(userId).filter((n) => n.id !== id)
  );
  notifyUpdated();
}

export function createLocalNote(
  userId: string,
  title = "",
  content = ""
): Note {
  const now = new Date().toISOString();
  const note: Note = {
    id: crypto.randomUUID(),
    title,
    content,
    created_at: now,
    updated_at: now,
  };
  upsertLocalNote(userId, note);
  addOutboxEntry(userId, { note, mode: "create" });
  return note;
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

  try {
    window.localStorage.setItem(outboxKey(userId), JSON.stringify(entries));
  } catch {}
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

  try {
    window.localStorage.setItem(deletedKey(userId), JSON.stringify(ids));
  } catch {}
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
  try {
    window.localStorage.setItem(lastKey(userId), id);
  } catch {}
}

export function clearLastNoteId(userId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(lastKey(userId));
  } catch {}
}