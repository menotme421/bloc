import { getDisplayName, tryGetUser, tryVerifySession } from "@/lib/dal";
import { tryGetRecentNotes } from "@/lib/notes";
import { AppHeader } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";
import { SyncOnMount } from "@/components/sync-on-mount";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { AuthTracker } from "@/components/auth-tracker";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await tryVerifySession();
  const user = await tryGetUser();
  const recentNotes = await tryGetRecentNotes(5);

  const name = user ? getDisplayName(user) : "User";
  const userId = session?.userId ?? "";

  return (
    <SidebarProvider>
      <AuthTracker userId={userId} />
      <AppSidebar
        userName={name}
        userEmail={user?.email ?? ""}
        userAvatar={(user?.user_metadata?.avatar_url as string | null) ?? null}
        userId={userId}
        recentNotes={recentNotes}
      />
      <SyncOnMount userId={userId} />
      <SidebarInset>
        <AppHeader userId={userId} />
        <main className="flex flex-1 flex-col gap-4 p-4 pt-0 pb-28 md:pb-4">{children}</main>
        <MobileBottomNav userId={userId} />
      </SidebarInset>
    </SidebarProvider>
  );
}