"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { tryVerifySession } from "@/lib/dal";
import { createNoteSchema, updateNoteSchema } from "@/lib/definitions";
import type { Note } from "@/lib/notes";

export type NoteActionResult =
  | { ok: true; note?: Note }
  | { ok: false; error: string };

const HISTORY_CAP_PER_NOTE = 100;
const HISTORY_RETENTION_DAYS = 30;

async function recordVersion(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  note: { id: string; title: string; content: string; tag: string | null },
  op: "create" | "update" | "delete" | "restore"
) {
  try {
    await supabase.from("note_versions").insert({
      user_id: userId,
      note_id: note.id,
      title: note.title,
      content: note.content,
      tag: note.tag,
      op,
    });
    await pruneVersions(supabase, userId, note.id);
  } catch (e) {
    // History is best-effort; never block CRUD on it.
    console.error("[notes] recordVersion failed", e);
  }
}

async function pruneVersions(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  noteId: string
) {
  try {
    // 30-day retention
    const cutoff = new Date(
      Date.now() - HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();
    await supabase
      .from("note_versions")
      .delete()
      .eq("user_id", userId)
      .eq("note_id", noteId)
      .lt("created_at", cutoff);
    // 100-per-note cap: keep newest N
    const { data } = await supabase
      .from("note_versions")
      .select("id, created_at")
      .eq("user_id", userId)
      .eq("note_id", noteId)
      .order("created_at", { ascending: false })
      .range(HISTORY_CAP_PER_NOTE, 1000);
    if (data && data.length > 0) {
      await supabase
        .from("note_versions")
        .delete()
        .in(
          "id",
          data.map((r) => r.id)
        );
    }
  } catch (e) {
    console.error("[notes] pruneVersions failed", e);
  }
}

export async function createNote(input: {
  id?: string;
  title: string;
  content: string;
  tag?: string | null;
}): Promise<NoteActionResult> {
  const session = await tryVerifySession();
  if (!session) {
    return { ok: false, error: "Not authenticated." };
  }
  const { userId } = session;

  const validated = createNoteSchema.safeParse(input);
  if (!validated.success) {
    return { ok: false, error: validated.error.issues[0]?.message ?? "Invalid input." };
  }

  const { id, ...note } = validated.data;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("notes")
    .insert({ id, user_id: userId, ...note })
    .select("id, title, content, tag, created_at, updated_at")
    .single();

  if (error) {
    console.error("[notes] createNote failed", error.message);
    return { ok: false, error: error.message };
  }

  const created = data as Note;
  await recordVersion(
    supabase,
    userId,
    { id: created.id, title: created.title, content: created.content, tag: created.tag },
    "create"
  );
  revalidatePath("/app/notes");
  return { ok: true, note: created };
}

export async function updateNote(input: {
  id: string;
  title: string;
  content: string;
  tag?: string | null;
}): Promise<NoteActionResult> {
  const session = await tryVerifySession();
  if (!session) {
    return { ok: false, error: "Not authenticated." };
  }
  const { userId } = session;

  const validated = updateNoteSchema.safeParse(input);
  if (!validated.success) {
    return { ok: false, error: validated.error.issues[0]?.message ?? "Invalid input." };
  }

  const { id, ...patch } = validated.data;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("notes")
    .update(patch)
    .eq("id", id)
    .eq("user_id", userId)
    .select("id, title, content, tag, created_at, updated_at")
    .maybeSingle();

  if (error) {
    console.error("[notes] updateNote failed", error.message);
    return { ok: false, error: error.message };
  }

  if (!data) {
    return { ok: false, error: "Note not found." };
  }

  const updated = data as Note;
  await recordVersion(
    supabase,
    userId,
    { id: updated.id, title: updated.title, content: updated.content, tag: updated.tag },
    "update"
  );
  revalidatePath("/app/notes");
  return { ok: true, note: updated };
}

export async function deleteNote(id: string): Promise<NoteActionResult> {
  const session = await tryVerifySession();
  if (!session) {
    return { ok: false, error: "Not authenticated." };
  }
  const { userId } = session;

  const supabase = await createSupabaseServerClient();
  // Snapshot for history before deleting.
  try {
    const { data: existing } = await supabase
      .from("notes")
      .select("id, title, content, tag")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();
    if (existing) {
      await recordVersion(
        supabase,
        userId,
        {
          id: (existing as { id: string }).id,
          title: (existing as { title: string }).title ?? "",
          content: (existing as { content: string }).content ?? "",
          tag: (existing as { tag: string | null }).tag ?? null,
        },
        "delete"
      );
    }
  } catch (e) {
    console.error("[notes] deleteNote snapshot failed", e);
  }

  const { error } = await supabase
    .from("notes")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    console.error("[notes] deleteNote failed", error.message);
    return { ok: false, error: error.message };
  }

  revalidatePath("/app/notes");
  return { ok: true };
}

export type NotesListResult =
  | { ok: true; notes: Note[] }
  | { ok: false; error: string };

export async function listNotesResult(): Promise<NotesListResult> {
  const session = await tryVerifySession();
  if (!session) return { ok: false, error: "Not authenticated." };
  const { userId } = session;
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("notes")
      .select("id, title, content, tag, created_at, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });
    if (error) {
      console.error("[notes] listNotes failed", error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true, notes: (data ?? []) as Note[] };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Network offline.";
    return { ok: false, error: message };
  }
}

export async function listNotes(): Promise<Note[]> {
  const result = await listNotesResult();
  return result.ok ? result.notes : [];
}