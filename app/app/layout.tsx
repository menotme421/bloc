import { getUser, verifySession } from "@/lib/dal";
import { getRecentNotes } from "@/lib/notes";
import { AppHeader } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";
import { SyncOnMount } from "@/components/sync-on-mount";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

function titleCase(value: string) {
  return value
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();
  const { userId } = await verifySession();
  const recentNotes = await getRecentNotes(5);

  const name =
    (user.user_metadata?.full_name as string | undefined) ??
    titleCase(user.email?.split("@")[0] ?? "User");

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
        <main className="flex flex-1 flex-col gap-4 p-4 pt-0">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}