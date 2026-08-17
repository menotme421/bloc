"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"

import { NavMain } from "@/components/nav-main"
import { NavUser, type NavUserData } from "@/components/nav-user"
import { SearchCommand } from "@/components/search-command"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import { BlocksIcon, HomeIcon, PlusIcon, SearchIcon } from "lucide-react"
import {
  createLocalNote,
  getLocalNotes,
  getRecentNotesSnapshot,
  EMPTY_NOTES,
  setLastNoteId,
  subscribeNotes,
  upsertLocalNote,
} from "@/lib/local-notes"
import type { Note } from "@/lib/notes"
import { NoteSidebarItem } from "@/components/note-sidebar-item"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
} from "@/components/ui/sidebar"

const RECENT_LIMIT = 5

export function AppSidebar({
  user,
  userId,
  recentNotes,
  ...props
}: {
  user: NavUserData
  userId: string
  recentNotes?: Note[]
} & React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const router = useRouter()
  const [searchOpen, setSearchOpen] = React.useState(false)
  const recent = React.useSyncExternalStore(
    subscribeNotes,
    () => getRecentNotesSnapshot(userId, RECENT_LIMIT),
    () => EMPTY_NOTES
  )

  React.useEffect(() => {
    if (recentNotes && recentNotes.length > 0) {
      const cached = new Map(getLocalNotes(userId).map((n) => [n.id, n]))
      for (const serverNote of recentNotes) {
        const local = cached.get(serverNote.id)
        if (
          !local ||
          Date.parse(serverNote.updated_at) >= Date.parse(local.updated_at)
        ) {
          upsertLocalNote(userId, serverNote)
        }
      }
    }
  }, [userId, recentNotes])

  function handleCreateNote() {
    const note = createLocalNote(userId)
    setLastNoteId(userId, note.id)
    router.push(`/app/notes/${note.id}`)
  }

  return (
    <Sidebar className="border-r-0" {...props}>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <BlocksIcon className="size-4" />
          <span className="truncate text-body-semibold tracking-[-0.05em]">Bloc</span>
        </div>
        <NavMain
          items={[
            {
              title: "Home",
              url: "/app",
              icon: <HomeIcon />,
              isActive: pathname === "/app",
            },
            {
              title: "Search",
              icon: <SearchIcon />,
              onSelect: () => setSearchOpen(true),
            },
            {
              title: "Create note",
              icon: <PlusIcon />,
              onSelect: handleCreateNote,
            },
          ]}
        />
      </SidebarHeader>
      <SidebarContent className="px-2">
        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="h-6">Recent</SidebarGroupLabel>
          <SidebarGroupContent>
            {recent.length > 0 ? (
              <SidebarMenu className="gap-0.5">
                {recent.map((note) => (
                  <NoteSidebarItem
                    key={note.id}
                    userId={userId}
                    note={note}
                  />
                ))}
              </SidebarMenu>
            ) : (
              <p className="px-2 py-1.5 text-xs text-foreground-muted">
                No notes yet
              </p>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
      <SearchCommand open={searchOpen} onOpenChange={setSearchOpen} />
    </Sidebar>
  )
}