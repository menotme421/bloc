"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  signUpSchema,
  signInSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@/lib/definitions";
import { verifySession } from "@/lib/dal";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { SITE_URL } from "@/lib/supabase/config";

export type AuthState = {
  error: string | null;
  errorType?:
    | "invalid_credentials"
    | "email_not_confirmed"
    | "user_not_found"
    | "google_account"
    | "unexpected"
    | undefined;
  message?: string | undefined;
  email?: string | undefined;
};

async function getOrigin() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl) {
    return siteUrl;
  }
  if (process.env.NODE_ENV === "production") {
    return SITE_URL;
  }
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  return host ? `http://${host}` : SITE_URL;
}

export async function signUp(
  prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const validated = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirm-password"),
  });

  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "Invalid input." };
  }

  const { email, password } = validated.data;
  const origin = await getOrigin();

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });

  if (error) {
    return { error: error.message };
  }

  if (data.session) {
    redirect("/app");
  }

  return {
    error: null,
    message: "Check your email to confirm your sign up.",
    email: data.user?.email ?? email,
  };
}

export async function signIn(
  prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const validated = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "Invalid input." };
  }

  const { email, password } = validated.data;

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.code === "invalid_credentials") {
      const { data: providers, error: rpcError } = await supabase.rpc(
        "get_auth_providers",
        { p_email: email }
      );

      if (!rpcError && Array.isArray(providers)) {
        if (providers.length === 0) {
          return {
            error: "Account not found. Click Sign up to create an account.",
            errorType: "user_not_found",
          };
        }
        if (providers.includes("google")) {
          return {
            error:
              "This account was created with Google. Sign in with Google to continue.",
            errorType: "google_account",
          };
        }
      }

      return {
        error: "Wrong password or email.",
        errorType: "invalid_credentials",
      };
    }
    if (
      error.code === "email_not_confirmed" ||
      error.message.includes("Email not confirmed")
    ) {
      return {
        error:
          "Email not confirmed. Check your inbox and click the confirmation link.",
        errorType: "email_not_confirmed",
      };
    }
    if (
      error.code === "over_request_rate_limit" ||
      error.code === "over_email_send_rate_limit"
    ) {
      return {
        error: "Too many attempts. Please wait a few minutes and try again.",
        errorType: "unexpected",
      };
    }
    console.error("[auth] signIn failed", error.code, error.message);
    return {
      error: error.message,
      errorType: "unexpected",
    };
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
  const origin = await getOrigin();

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
      queryParams: { prompt: "select_account" },
    },
  });

  if (error) throw new Error(error.message);
  redirect(data.url!);
}

export async function resetPassword(
  prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const validated = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });

  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "Invalid input." };
  }

  const { email } = validated.data;
  const origin = await getOrigin();

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback`,
  });

  if (error) {
    console.error("[auth] resetPasswordForEmail failed", {
      code: error.code,
      message: error.message,
    });
    if (
      error.code === "over_request_rate_limit" ||
      error.code === "over_email_send_rate_limit"
    ) {
      return {
        error: "Too many attempts. Please wait a few minutes and try again.",
      };
    }
    return { error: error.message };
  }

  return {
    error: null,
    message: "Check your email to reset your password.",
    email,
  };
}

export async function updatePassword(
  prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const validated = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirm-password"),
  });

  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "Invalid input." };
  }

  const { password } = validated.data;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    console.error("[auth] updateUser(password) failed", {
      code: error.code,
      message: error.message,
    });
    if (
      error.code === "over_request_rate_limit" ||
      error.code === "over_email_send_rate_limit"
    ) {
      return {
        error: "Too many attempts. Please wait a few minutes and try again.",
      };
    }
    return { error: error.message };
  }

  await supabase.auth.signOut();
  redirect("/auth?mode=signin&message=password_updated");
}

export async function signOut() {
  await verifySession();
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}
