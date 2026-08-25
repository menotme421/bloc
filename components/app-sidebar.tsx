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
import { Library, PlusIcon } from "lucide-react"
import { useI18n } from "@/lib/i18n/provider"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  createLocalNote,
  getAllNotesSnapshot,
  getLocalNotes,
  getNoteSnapshot,
  getRecentOpenedNotesSnapshot,
  EMPTY_NOTES,
  markNoteOpened,
  subscribeNotes,
  upsertLocalNote,
} from "@/lib/local-notes"
import type { Note } from "@/lib/notes"
import { NoteSidebarItem } from "@/components/note-sidebar-item"
import { TagChip } from "@/components/tag-chip"
import { Separator } from "@/components/ui/separator"
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
  const { t } = useI18n()
  const isMobile = useIsMobile()
  const [searchOpen, setSearchOpen] = React.useState(false)
  const isNotePage = pathname.startsWith("/app/notes/")

  const recent = React.useSyncExternalStore(
    subscribeNotes,
    () => getRecentOpenedNotesSnapshot(userId, RECENT_LIMIT),
    () => EMPTY_NOTES
  )
  const currentNoteId = isNotePage ? pathname.split("/").pop() : null

  const currentNote = React.useSyncExternalStore(
    subscribeNotes,
    () => (currentNoteId ? getNoteSnapshot(userId, currentNoteId) : null),
    () => null
  )

  const allNotes = React.useSyncExternalStore(
    subscribeNotes,
    () => getAllNotesSnapshot(userId),
    () => EMPTY_NOTES
  )

  const relatedNotes = React.useMemo(() => {
    const tag = currentNote?.tag
    if (!tag || !currentNoteId) return []
    return allNotes.filter(
      (note) => note.id !== currentNoteId && note.tag === tag
    )
  }, [currentNote, currentNoteId, allNotes])

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
    markNoteOpened(userId, note.id)
    router.push(`/app/notes/${note.id}`)
  }

  // Sidebar not used on smartphone — bottom nav handles mobile. Hide entirely on mobile.
  if (isMobile) return null

  return (
    <Sidebar className="border-r-0" {...props}>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <span className="truncate text-[1.75rem] font-bold tracking-tight leading-none">Bloc</span>
        </div>
        <NavMain
          items={[
            {
              title: t("sidebar.search"),
              icon: <Library />,
              onSelect: () => setSearchOpen(true),
            },
            {
              title: t("sidebar.createNote"),
              icon: <PlusIcon />,
              onSelect: handleCreateNote,
            },
          ]}
        />
      </SidebarHeader>
      <SidebarContent className="px-2">
        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="h-6">{t("sidebar.recent")}</SidebarGroupLabel>
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
              <p className="px-2 py-1.5 text-xs text-muted-foreground">
                {t("sidebar.noNotesYet")}
              </p>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
        {currentNote?.tag && (
          <>
            <Separator className="my-3" />
            <SidebarGroup className="p-0">
              <SidebarGroupLabel className="h-6 gap-1.5">
                {t("sidebar.notesWith")}
                <TagChip tag={currentNote.tag} className="h-5" />
              </SidebarGroupLabel>
              <SidebarGroupContent>
                {relatedNotes.length > 0 ? (
                  <SidebarMenu className="gap-0.5">
                    {relatedNotes.map((note) => (
                      <NoteSidebarItem
                        key={note.id}
                        userId={userId}
                        note={note}
                      />
                    ))}
                  </SidebarMenu>
                ) : (
                  <p className="px-2 py-1.5 text-xs text-muted-foreground">
                    {t("sidebar.noOtherWithTag")}
                  </p>
                )}
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
      <SearchCommand
        open={searchOpen}
        onOpenChange={setSearchOpen}
        userId={userId}
      />
    </Sidebar>
  )
}