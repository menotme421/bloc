import { getDisplayName, getUser, verifySession } from "@/lib/dal";
import { MobileHome, DesktopHomeFallback } from "@/components/mobile-home";

export default async function HomePage() {
  const { userId } = await verifySession();
  const user = await getUser();
  const name = getDisplayName(user);
  const avatar = (user.user_metadata?.avatar_url as string | null) ?? null;

  return (
    <>
      <MobileHome
        userId={userId}
        user={{ name, avatar }}
      />
      <DesktopHomeFallback />
    </>
  );
}
