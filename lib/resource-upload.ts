import { supabase } from "@/lib/supabase/client";

function genId() {
  try {
    if (typeof globalThis !== "undefined" && globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  } catch {}
  // Fallback for http / non-secure context (LAN IP 10.16.204.50:3000)
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function uploadResourceFile(
  file: File,
  userId: string
): Promise<string> {
  const path = `${userId}/${genId()}-${file.name}`;
  const { data, error } = await supabase.storage
    .from("note-resources")
    .upload(path, file, {
      cacheControl: "3600",
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (error) throw new Error(error.message);
  const { data: publicData } = supabase.storage
    .from("note-resources")
    .getPublicUrl(data.path);
  return publicData.publicUrl;
}