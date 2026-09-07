"use client";

import * as React from "react";
import { RotateCcwClockIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  listNoteVersions,
  restoreNoteVersion,
  type NoteVersion,
} from "@/app/app/notes/history-actions";
import { upsertLocalNote } from "@/lib/local-notes";

function excerpt(html: string, len = 120): string {
  const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return text.length > len ? text.slice(0, len) + "…" : text || "(empty)";
}

function relativeTime(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return "just now";
  if (diff < hour) {
    const m = Math.floor(diff / minute);
    return `${m}m ago`;
  }
  if (diff < day) {
    const h = Math.floor(diff / hour);
    return `${h}h ago`;
  }
  if (diff < 7 * day) {
    return new Date(then).toLocaleDateString([], { weekday: "short" });
  }
  return new Date(then).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

const OP_BADGE_STYLES: Record<NoteVersion["op"], string> = {
  create: "text-success",
  update: "text-muted-foreground",
  delete: "text-destructive",
  restore: "text-warning",
};

export function NoteHistory({
  userId,
  noteId,
  open: controlledOpen,
  onOpenChange,
  showTrigger = true,
}: {
  userId: string;
  noteId: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
}) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [loading, setLoading] = React.useState(false);
  const [versions, setVersions] = React.useState<NoteVersion[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [restoringId, setRestoringId] = React.useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const res = await listNoteVersions(noteId);
    setLoading(false);
    if (!res.ok) {
      // Offline or unauthenticated: history needs server.
      setError(res.error);
      setVersions([]);
      return;
    }
    setVersions(res.versions);
  }

  // Load on dialog open (client event, not render-derived state).
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, noteId]);

  async function handleRestore(v: NoteVersion) {
    setRestoringId(v.id);
    const res = await restoreNoteVersion(v.id);
    setRestoringId(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    // Update local cache immediately so editor reflects restore offline-first.
    if (userId) {
      upsertLocalNote(userId, res.note);
      try {
        window.location.reload();
      } catch {}
    }
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {showTrigger && (
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" aria-label="Note history">
            <RotateCcwClockIcon className="size-3.5" />
            History
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[80dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Note history</DialogTitle>
          <DialogDescription>
            Last 100 versions, kept 30 days. Restore creates a new version — nothing is overwritten.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
        ) : error ? (
          <div className="rounded-xl border border-dashed p-6 text-center">
            <p className="text-sm font-medium">History unavailable offline</p>
            <p className="mt-1 text-xs text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        ) : versions.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No history yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {versions.map((v) => {
              return (
                <div key={v.id} className="rounded-xl border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize ${OP_BADGE_STYLES[v.op]}`}
                    >
                      {v.op}
                    </span>
                    <span
                      className="text-[11px] text-muted-foreground"
                      title={new Date(v.created_at).toLocaleString()}
                    >
                      {relativeTime(v.created_at)}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm font-medium">
                    {v.title.trim() || "Untitled"}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {excerpt(v.content)}
                  </p>
                  <div className="mt-2 flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={restoringId === v.id}
                      onClick={() => void handleRestore(v)}
                    >
                      {restoringId === v.id ? "Restoring…" : "Restore"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
