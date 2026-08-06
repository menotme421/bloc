import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SignupForm } from "@/components/signup-form"

const ERROR_MESSAGES: Record<string, string> = {
  otp_invalid:
    "The confirmation link is invalid or has already been used.",
  token_expired:
    "The link has expired. Please request a new one.",
  auth_code_exchange:
    "Something went wrong while signing you in. Please try again.",
  missing_params:
    "The link you followed is incomplete. Please try again.",
  invalid_recovery:
    "This password reset link is invalid or has expired. Please request a new one.",
};

const SUCCESS_MESSAGES: Record<string, string> = {
  password_updated:
    "Password updated. Sign in with your new password.",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; error?: string; message?: string }>
}) {
  const { mode, error, message } = await searchParams

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    redirect("/app");
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background-subtle p-6 md:p-10">
      <div className="w-full max-w-sm md:max-w-4xl">
        <SignupForm
          initialMode={mode === "signin" ? "signin" : "signup"}
          errorMessage={
            error ? ERROR_MESSAGES[error] ?? "Something went wrong. Please try again." : undefined
          }
          successMessage={
            message ? SUCCESS_MESSAGES[message] : undefined
          }
        />
      </div>
    </div>
  )
}
