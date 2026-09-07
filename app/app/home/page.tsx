import { getDisplayName, tryGetUser, tryVerifySession } from "@/lib/dal";
import { MobileHome, DesktopHomeFallback } from "@/components/mobile-home";

export default async function HomePage() {
  const session = await tryVerifySession();
  const user = await tryGetUser();
  const name = user ? getDisplayName(user) : "User";
  const avatar = (user?.user_metadata?.avatar_url as string | null) ?? null;

  return (
    <>
      <MobileHome
        userId={session?.userId ?? ""}
        user={{ name, avatar }}
      />
      <DesktopHomeFallback />
    </>
  );
}
