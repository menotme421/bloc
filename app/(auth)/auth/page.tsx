import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SignupForm } from "@/components/signup-form"

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>
}) {
  const { mode } = await searchParams

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
        />
      </div>
    </div>
  )
}