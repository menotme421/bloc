import "server-only";

import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { verifySession } from "@/lib/dal";

export type Note = {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
};

const NOTE_COLUMNS = "id, title, content, created_at, updated_at";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const getRecentNotes = cache(async (limit = 8) => {
  const { userId } = await verifySession();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("notes")
    .select(NOTE_COLUMNS)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[notes] getRecentNotes failed", error.message);
    throw new Error(error.message);
  }

  return (data ?? []) as Note[];
});

export const getNote = cache(async (id: string) => {
  if (!UUID_PATTERN.test(id)) {
    return null;
  }

  const { userId } = await verifySession();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("notes")
    .select(NOTE_COLUMNS)
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[notes] getNote failed", error.message);
    throw new Error(error.message);
  }

  return data as Note | null;
});