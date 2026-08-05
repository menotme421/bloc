import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "@/components/reset-password-form"

export default async function ResetPasswordPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth?error=invalid_recovery");
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background-subtle p-6 md:p-10">
      <div className="w-full max-w-sm md:max-w-md">
        <ResetPasswordForm />
      </div>
    </div>
  )
}
