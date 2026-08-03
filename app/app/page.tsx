import { getUser } from "@/lib/dal";
import { signOut } from "@/app/(auth)/auth/actions";

export default async function AppPage() {
  const user = await getUser();

  return (
    <div>
      <p>App page — signed in as {user.email}</p>
      <form action={signOut}>
        <button type="submit" className="btn btn-secondary btn-sm">
          Sign out
        </button>
      </form>
    </div>
  );
}
