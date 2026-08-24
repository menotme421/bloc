"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getLastNoteId, getLocalNote } from "@/lib/local-notes";

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

    // No valid last session — go to home, not create a new note
    router.replace("/app/home");
  }, [userId, router]);

  return null;
}