"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { tryVerifySession } from "@/lib/dal";
import type { Note } from "@/lib/notes";

export type NoteVersion = {
  id: string;
  note_id: string;
  title: string;
  content: string;
  tag: string | null;
  op: "create" | "update" | "delete" | "restore";
  created_at: string;
};

export async function listNoteVersions(
  noteId: string
): Promise<{ ok: true; versions: NoteVersion[] } | { ok: false; error: string }> {
  const session = await tryVerifySession();
  if (!session) return { ok: false, error: "Not authenticated." };
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("note_versions")
      .select("id, note_id, title, content, tag, op, created_at")
      .eq("user_id", session.userId)
      .eq("note_id", noteId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) return { ok: false, error: error.message };
    return { ok: true, versions: (data ?? []) as NoteVersion[] };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Offline." };
  }
}

export async function restoreNoteVersion(versionId: string): Promise<
  { ok: true; note: Note } | { ok: false; error: string }
> {
  const session = await tryVerifySession();
  if (!session) return { ok: false, error: "Not authenticated." };
  try {
    const supabase = await createSupabaseServerClient();
    const { data: version, error: vError } = await supabase
      .from("note_versions")
      .select("id, note_id, title, content, tag")
      .eq("id", versionId)
      .eq("user_id", session.userId)
      .maybeSingle();
    if (vError) return { ok: false, error: vError.message };
    if (!version) return { ok: false, error: "Version not found." };
    const v = version as { note_id: string; title: string; content: string; tag: string | null };

    // Restore = update live note (or re-insert if deleted elsewhere).
    const { data: existing } = await supabase
      .from("notes")
      .select("id")
      .eq("id", v.note_id)
      .eq("user_id", session.userId)
      .maybeSingle();

    let note: Note | null = null;
    if (existing) {
      const { data, error } = await supabase
        .from("notes")
        .update({ title: v.title, content: v.content, tag: v.tag })
        .eq("id", v.note_id)
        .eq("user_id", session.userId)
        .select("id, title, content, tag, created_at, updated_at")
        .maybeSingle();
      if (error) return { ok: false, error: error.message };
      note = data as Note | null;
    } else {
      const { data, error } = await supabase
        .from("notes")
        .insert({
          id: v.note_id,
          user_id: session.userId,
          title: v.title,
          content: v.content,
          tag: v.tag,
        })
        .select("id, title, content, tag, created_at, updated_at")
        .single();
      if (error) return { ok: false, error: error.message };
      note = data as Note;
    }
    if (!note) return { ok: false, error: "Restore failed." };

    await supabase.from("note_versions").insert({
      user_id: session.userId,
      note_id: note.id,
      title: note.title,
      content: note.content,
      tag: note.tag,
      op: "restore",
    });

    revalidatePath("/app/notes");
    return { ok: true, note };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Offline." };
  }
}
