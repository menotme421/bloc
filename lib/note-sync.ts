import { createNote, deleteNote, listNotesResult, updateNote } from "@/app/app/notes/actions";
import type { Note } from "@/lib/notes";
import {
  clearLastNoteId,
  getLastNoteId,
  getLocalNotes,
  getOutbox,
  getTombstones,
  removeLocalNote,
  removeOutboxEntry,
  removeTombstone,
  upsertLocalNote,
} from "@/lib/local-notes";

export type SyncStatus = "synced" | "saving" | "offline";

function deviceOffline(): boolean {
  try {
    return typeof navigator !== "undefined" && navigator.onLine === false;
  } catch {
    return false;
  }
}

export async function syncNote(
  userId: string,
  note: Note,
  mode: "create" | "update"
): Promise<SyncStatus> {
  // Offline: never fire a server round-trip (with wifi on but no route out
  // it hangs for tens of seconds and freezes the editor behind it).
  if (deviceOffline()) return "offline";
  if (getTombstones(userId).includes(note.id)) {
    removeOutboxEntry(userId, note.id);
    return "synced";
  }

  try {
    if (mode === "create") {
      const created = await createNote({
        id: note.id,
        title: note.title,
        content: note.content,
        tag: note.tag,
      });
      if (created.ok && created.note) {
        removeOutboxEntry(userId, note.id);
        upsertLocalNote(userId, created.note);
        return "synced";
      }
      const updated = await updateNote({
        id: note.id,
        title: note.title,
        content: note.content,
        tag: note.tag,
      });
      if (updated.ok && updated.note) {
        removeOutboxEntry(userId, note.id);
        upsertLocalNote(userId, updated.note);
        return "synced";
      }
      return "offline";
    }

    const updated = await updateNote({
      id: note.id,
      title: note.title,
      content: note.content,
      tag: note.tag,
    });
    if (updated.ok && updated.note) {
      removeOutboxEntry(userId, note.id);
      upsertLocalNote(userId, updated.note);
      return "synced";
    }
    return "offline";
  } catch {
    return "offline";
  }
}

export async function syncPending(userId: string) {
  if (deviceOffline()) return;
  const tombstones = getTombstones(userId);
  const outbox = getOutbox(userId);

  const pendingDeletes = [...tombstones];
  const tombstonedIds = new Set(tombstones);

  for (const entry of outbox) {
    if (tombstonedIds.has(entry.note.id)) {
      removeOutboxEntry(userId, entry.note.id);
      continue;
    }
    try {
      await syncNote(userId, entry.note, entry.mode);
    } catch {
      continue;
    }
  }

  for (const id of pendingDeletes) {
    try {
      const result = await deleteNote(id);
      if (result.ok) {
        removeTombstone(userId, id);
        removeLocalNote(userId, id);
        if (getLastNoteId(userId) === id) clearLastNoteId(userId);
      }
    } catch {
      continue;
    }
  }

  // Pull server state: delete local notes that were deleted on another device,
  // and upsert any newer server notes. Only when the server round-trip
  // succeeded — offline (ok:false) must never wipe or fake-clean locals.
  try {
    const pulled = await listNotesResult();
    if (!pulled.ok) return;
    const serverNotes = pulled.notes;
    if (serverNotes.length > 0 || getLocalNotes(userId).length === 0) {
      const serverIds = new Set(serverNotes.map((n) => n.id));
      const outboxIds = new Set(getOutbox(userId).map((e) => e.note.id));
      const tombIds = new Set(getTombstones(userId));
      for (const local of getLocalNotes(userId)) {
        if (!serverIds.has(local.id) && !outboxIds.has(local.id) && !tombIds.has(local.id)) {
          removeLocalNote(userId, local.id);
          if (getLastNoteId(userId) === local.id) clearLastNoteId(userId);
        }
      }
      for (const serverNote of serverNotes) {
        const local = getLocalNotes(userId).find((n) => n.id === serverNote.id);
        if (!local || Date.parse(serverNote.updated_at) > Date.parse(local.updated_at)) {
          upsertLocalNote(userId, serverNote);
        }
      }
    }
  } catch {
    // pull is best-effort; push already succeeded
  }
}