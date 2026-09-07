"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/lib/supabase/config";
import { tryVerifySession } from "@/lib/dal";
import { displayNameSchema } from "@/lib/definitions";

export type SettingsState = {
  error: string | null;
  message?: string | undefined;
};

export async function updateDisplayName(
  prevState: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const validated = displayNameSchema.safeParse(
    formData.get("display-name")
  );

  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "Invalid input." };
  }

  const session = await tryVerifySession();
  if (!session) {
    return { error: "Not authenticated." };
  }
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Authentication failed." };
  }

  const { error } = await supabase.auth.updateUser({
    data: {
      ...(user.user_metadata ?? {}),
      full_name: validated.data,
    },
  });

  if (error) {
    console.error("[settings] updateUser(full_name) failed", {
      code: error.code,
      message: error.message,
    });
    return { error: error.message };
  }

  revalidatePath("/app", "layout");
  return { error: null, message: "Saved." };
}

export async function deleteAccount(
  prevState: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  void prevState;
  void formData;

  const sess = await tryVerifySession();
  if (!sess) {
    return { error: "Not authenticated." };
  }
  const { userId } = sess;
  const supabase = await createSupabaseServerClient();

  // Best-effort data cleanup before the account is removed.
  try {
    const { error: notesError } = await supabase
      .from("notes")
      .delete()
      .eq("user_id", userId);
    if (notesError) {
      console.error("[settings] notes cleanup failed", notesError.message);
    }
  } catch (e) {
    console.error("[settings] notes cleanup threw", e);
  }

  try {
    const { data: objects, error: listError } = await supabase.storage
      .from("note-resources")
      .list(userId, { limit: 1000 });
    if (listError) {
      console.error("[settings] storage list failed", listError.message);
    } else if (objects && objects.length > 0) {
      const { error: removeError } = await supabase.storage
        .from("note-resources")
        .remove(objects.map((o) => `${userId}/${o.name}`));
      if (removeError) {
        console.error("[settings] storage remove failed", removeError.message);
      }
    }
  } catch (e) {
    console.error("[settings] storage cleanup threw", e);
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) {
    return { error: "Authentication failed." };
  }

  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: SUPABASE_PUBLISHABLE_KEY,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    console.error("[settings] GoTrue deleteUser failed", res.status);
    const body = await res.json().catch(() => null);
    const message =
      (body?.error_description as string | undefined) ??
      (body?.msg as string | undefined) ??
      "Could not delete the account. Please try again.";
    return { error: message };
  }

  await supabase.auth.signOut();
  redirect("/");
}