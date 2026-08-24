import { getDisplayName, getUser, verifySession } from "@/lib/dal";
import { getRecentNotes } from "@/lib/notes";
import { AppHeader } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";
import { SyncOnMount } from "@/components/sync-on-mount";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();
  const { userId } = await verifySession();
  const recentNotes = await getRecentNotes(5);

  const name = getDisplayName(user);

  return (
    <SidebarProvider>
      <AppSidebar
        user={{
          name,
          email: user.email ?? "",
          avatar: (user.user_metadata?.avatar_url as string | null) ?? null,
        }}
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