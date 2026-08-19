import { supabase } from "@/lib/supabase/client";

export async function uploadResourceFile(
  file: File,
  userId: string
): Promise<string> {
  const path = `${userId}/${crypto.randomUUID()}-${file.name}`;
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