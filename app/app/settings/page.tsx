import { getDisplayName, getUser } from "@/lib/dal";
import { SettingsPage } from "@/components/settings-page";

export default async function SettingsPageRoute() {
  const user = await getUser();

  return <SettingsPage name={getDisplayName(user)} email={user.email ?? ""} />;
}