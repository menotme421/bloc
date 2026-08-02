import { createSupabaseServerClient } from "@/lib/supabase/server";
import { signOut } from "@/app/(auth)/auth/actions";

export default async function AppPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div>
      <p>App page — signed in as {user?.email}</p>
      <form action={signOut}>
        <button type="submit" className="btn btn-secondary btn-sm">
          Sign out
        </button>
      </form>
    </div>
  );
}