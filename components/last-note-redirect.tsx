"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  createLocalNote,
  getLastNoteId,
  getLocalNote,
  getLocalNotes,
  setLastNoteId,
} from "@/lib/local-notes";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function LastNoteRedirect({ userId }: { userId: string }) {
  const router = useRouter();

  useEffect(() => {
    const last = getLastNoteId(userId);
    if (last && UUID_PATTERN.test(last) && getLocalNote(userId, last)) {
      router.replace(`/app/notes/${last}`);
      return;
    }

    const notes = getLocalNotes(userId).sort(
      (a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at)
    );
    if (notes.length > 0) {
      setLastNoteId(userId, notes[0].id);
      router.replace(`/app/notes/${notes[0].id}`);
      return;
    }

    const note = createLocalNote(userId);
    setLastNoteId(userId, note.id);
    router.replace(`/app/notes/${note.id}`);
  }, [userId, router]);

  return null;
}