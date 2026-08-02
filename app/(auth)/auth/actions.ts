"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

export type AuthState = {
  error: string | null;
  message?: string | undefined;
};

export async function signUp(
  prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = formData.get("email");
  const password = formData.get("password");
  const confirmPassword = formData.get("confirm-password");

  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    typeof confirmPassword !== "string"
  ) {
    return { error: "Please fill in all fields." };
  }

  if (password !== confirmPassword) {
    return { error: "Passwords do not match." };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return { error: error.message };
  }

  if (data.session) {
    redirect("/app");
  }

  return { error: null, message: "Check your email to confirm your sign up." };
}

export async function signIn(
  prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = formData.get("email");
  const password = formData.get("password");

  if (typeof email !== "string" || typeof password !== "string") {
    return { error: "Please fill in all fields." };
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: error.message };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Authentication failed." };
  }

  redirect("/app");
}

export async function signInWithGoogle() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const protocol =
    process.env.NODE_ENV === "development" ? "http" : "https";
  const origin =
    siteUrl ??
    (host ? `${protocol}://${host}` : "http://localhost:3000");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback` },
  });

  if (error) throw new Error(error.message);
  redirect(data.url!);
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}