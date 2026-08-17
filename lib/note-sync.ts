import { createNote, deleteNote, updateNote } from "@/app/app/notes/actions";
import type { Note } from "@/lib/notes";
import {
  getOutbox,
  getTombstones,
  removeLocalNote,
  removeOutboxEntry,
  removeTombstone,
  upsertLocalNote,
} from "@/lib/local-notes";

export type SyncStatus = "synced" | "saving" | "offline";

export async function syncNote(
  userId: string,
  note: Note,
  mode: "create" | "update"
): Promise<SyncStatus> {
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
      }
    } catch {
      continue;
    }
  }
}