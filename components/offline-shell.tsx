"use client";

import * as React from "react";
import {
  EMPTY_NOTES,
  adoptOrphanedNotes,
  createLocalNote,
  getAllNotesSnapshot,
  getNoteSnapshot,
  markNoteOpened,
  subscribeNotes,
  removeLocalNote,
  removeOutboxEntry,
  addTombstone,
  getOutbox,
  getLastNoteId,
  clearLastNoteId,
} from "@/lib/local-notes";
import { getOfflineAuth } from "@/lib/auth-state";
import { syncPending } from "@/lib/note-sync";
import { useResolvedUserId } from "@/lib/use-resolved-user-id";
import { NoteEditor } from "@/components/note-editor";

// Functional offline shell. /offline is the one document the service worker
// precaches, so after an app restart with no connection every /app* navigate
// falls back to it. It must be a working notes surface — not a dead notice —
// or offline CRUD dies on restart. All state stays in this document: no
// router.push (a new /app/notes/<uuid> needs a server RSC fetch).
export function OfflineShell() {
  const userId = useResolvedUserId("");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [online, setOnline] = React.useState<boolean>(() =>
    typeof navigator === "undefined" ? true : navigator.onLine
  );

  const notes = React.useSyncExternalStore(
    subscribeNotes,
    // eslint-disable-next-line react-hooks/incompatible-library
    () => (userId ? getAllNotesSnapshot(userId) : EMPTY_NOTES),
    () => EMPTY_NOTES
  );

  // Adopt orphan notes once offline auth resolves (same as app shell).
  React.useEffect(() => {
    if (userId) adoptOrphanedNotes(userId);
  }, [userId]);

  // Track connectivity + drain outbox on reconnect.
  React.useEffect(() => {
    const onOnline = () => {
      setOnline(true);
      if (userId) void syncPending(userId);
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [userId]);

  const pending = userId ? getOutbox(userId).length : 0;
  const selected = userId && selectedId ? getNoteSnapshot(userId, selectedId) : null;

  function handleCreate() {
    if (!userId) return;
    const note = createLocalNote(userId);
    markNoteOpened(userId, note.id);
    setSelectedId(note.id);
  }

  function handleDelete(id: string) {
    if (!userId) return;
    removeLocalNote(userId, id);
    removeOutboxEntry(userId, id);
    addTombstone(userId, id);
    if (getLastNoteId(userId) === id) clearLastNoteId(userId);
    if (selectedId === id) setSelectedId(null);
  }

  if (!userId && typeof window !== "undefined" && !getOfflineAuth()) {
    return (
      <main className="min-h-dvh flex flex-col items-center justify-center p-6 text-center bg-background text-foreground">
        <div className="max-w-md w-full space-y-4">
          <h1 className="text-2xl font-semibold tracking-tight">You are offline</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Sign in once while online, then your notes work offline.
          </p>
        </div>
      </main>
    );
  }

  if (selectedId) {
    return (
      <main className="min-h-dvh flex flex-col bg-background text-foreground">
        <div className="sticky top-0 z-10 flex items-center gap-2 border-b bg-background/95 px-4 py-3 backdrop-blur">
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            ← All notes
          </button>
          <span
            className={`ml-auto rounded-full px-2.5 py-1 text-xs font-medium ${online ? "bg-muted text-muted-foreground" : "bg-foreground text-background"}`}
          >
            {online ? (pending > 0 ? `${pending} syncing…` : "Online") : `Offline${pending > 0 ? ` · ${pending} queued` : ""}`}
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-4 p-4">
          {selected ? (
            <NoteEditor
              key={selected.id}
              userId={userId}
              note={selected}
              noteId={selected.id}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Note not found on this device.</p>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh flex flex-col items-center bg-background text-foreground">
      <div className="w-full max-w-2xl space-y-6 p-6">
        <div className="flex items-center justify-between pt-2">
          <span className="text-[1.75rem] font-bold tracking-tight leading-none">Bloc</span>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${online ? "bg-muted text-muted-foreground" : "bg-foreground text-background"}`}
          >
            {online ? (pending > 0 ? `${pending} syncing…` : "Online") : `Offline${pending > 0 ? ` · ${pending} queued` : ""}`}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Your notes (on this device)</h1>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!userId}
            className="rounded-xl bg-foreground text-background px-4 py-2 text-sm font-medium hover:opacity-90 transition disabled:opacity-40"
          >
            + New note
          </button>
        </div>
        {notes.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">
              {online ? "No notes yet. Create one to get started." : "No cached notes on this device yet. Go online once to sync."}
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {notes.map((n) => (
              <li
                key={n.id}
                className="flex items-center gap-3 rounded-xl border bg-card p-3.5"
              >
                <button
                  type="button"
                  onClick={() => {
                    markNoteOpened(userId, n.id);
                    setSelectedId(n.id);
                  }}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block truncate text-sm font-semibold">
                    {n.title.trim() || "Untitled"}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {new Date(n.updated_at).toLocaleString()}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(n.id)}
                  aria-label="Delete note"
                  className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">
          Offline changes are queued on this device and sync when you reconnect.
        </p>
      </div>
    </main>
  );
}
