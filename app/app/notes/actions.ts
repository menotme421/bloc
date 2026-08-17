"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { verifySession } from "@/lib/dal";
import { createNoteSchema, updateNoteSchema } from "@/lib/definitions";
import type { Note } from "@/lib/notes";

export type NoteActionResult =
  | { ok: true; note?: Note }
  | { ok: false; error: string };

export async function createNote(input: {
  id?: string;
  title: string;
  content: string;
}): Promise<NoteActionResult> {
  const { userId } = await verifySession();

  const validated = createNoteSchema.safeParse(input);
  if (!validated.success) {
    return { ok: false, error: validated.error.issues[0]?.message ?? "Invalid input." };
  }

  const { id, ...note } = validated.data;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("notes")
    .insert({ id, user_id: userId, ...note })
    .select("id, title, content, created_at, updated_at")
    .single();

  if (error) {
    console.error("[notes] createNote failed", error.message);
    return { ok: false, error: error.message };
  }

  revalidatePath("/app/notes");
  return { ok: true, note: data as Note };
}

export async function updateNote(input: {
  id: string;
  title: string;
  content: string;
}): Promise<NoteActionResult> {
  const { userId } = await verifySession();

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
    .select("id, title, content, created_at, updated_at")
    .maybeSingle();

  if (error) {
    console.error("[notes] updateNote failed", error.message);
    return { ok: false, error: error.message };
  }

  if (!data) {
    return { ok: false, error: "Note not found." };
  }

  revalidatePath("/app/notes");
  return { ok: true, note: data as Note };
}

export async function deleteNote(id: string): Promise<NoteActionResult> {
  const { userId } = await verifySession();

  const supabase = await createSupabaseServerClient();
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