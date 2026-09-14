import { getDisplayName, tryGetUser, tryVerifySession } from "@/lib/dal";
import { SettingsPage } from "@/components/settings-page";

export default async function ProfilePage() {
  const session = await tryVerifySession();
  const user = await tryGetUser();
  return (
    <SettingsPage
      name={user ? getDisplayName(user) : "User"}
      email={user?.email ?? ""}
      userId={session?.userId ?? ""}
    />
  );
}
