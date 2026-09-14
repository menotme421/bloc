"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  SidebarTrigger,
} from "@/components/ui/sidebar"
import {
  getNoteSnapshot,
  subscribeNotes,
} from "@/lib/local-notes"
import {
  getSyncStatus,
  subscribeSyncStatus,
} from "@/lib/note-status"
import { useI18n } from "@/lib/i18n/provider"
import { useIsMobile } from "@/hooks/use-mobile"
import { ArrowLeftIcon, EllipsisIcon, RefreshCwIcon, RotateCcwClockIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useResolvedUserId } from "@/lib/use-resolved-user-id"
import { syncPending } from "@/lib/note-sync"
import { NoteHistory } from "@/components/note-history"
import { HelpMenu } from "@/components/help-menu"

export function AppHeader({ userId: userIdProp }: { userId: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const { t } = useI18n()
  const userId = useResolvedUserId(userIdProp)
  const [historyOpen, setHistoryOpen] = React.useState(false)
  const isMobile = useIsMobile()
  const isNotePage = pathname.startsWith("/app/notes/")
  const isMobileHome = pathname === "/app/home" || pathname === "/app/search"
  const noteId = isNotePage ? pathname.split("/").pop() : null

  function pageLabel(pathname: string): string | null {
    if (pathname === "/app") return t("header.home")
    if (pathname === "/app/home") return t("header.home")
    if (pathname === "/app/search") return t("header.search")
    if (pathname === "/app/notes") return t("header.notes")
    if (pathname === "/app/settings") return t("header.settings")
    if (pathname === "/app/profile") return t("header.settings")
    if (pathname === "/app/help") return t("help.helpCenter")
    if (pathname.startsWith("/app/notes/")) return t("header.untitled")
    return t("header.bloc")
  }

  const note = React.useSyncExternalStore(
    subscribeNotes,
    () => (noteId ? getNoteSnapshot(userId, noteId) : null),
    () => null
  )

  const syncStatus = React.useSyncExternalStore(
    subscribeSyncStatus,
    getSyncStatus,
    () => "synced" as const
  )

  const label =
    isNotePage && note && note.title.trim()
      ? note.title
      : pageLabel(pathname)

  // On mobile, hide header for home/search (those pages render their own Bloc branding).
  // Keep visible on desktop. For note pages, always show breadcrumb + sync.
  const headerVisibility = isMobileHome && !isNotePage ? "hidden md:flex" : "flex"

  // Sidebar not used on smartphone — hide trigger on mobile (bottom nav handles navigation)
  const showSidebarTrigger = !isMobile

  return (
    <header className={`${headerVisibility} h-14 shrink-0 items-center gap-2`}>
      <div className="flex flex-1 items-center gap-2 px-3">
        {isNotePage && isMobile ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Back to home"
            onClick={() => router.replace("/app/home")}
          >
            <ArrowLeftIcon />
            <span className="sr-only">Back</span>
          </Button>
        ) : showSidebarTrigger ? (
          <>
            <SidebarTrigger />
            <Separator
              orientation="vertical"
              className="mr-2 data-vertical:h-4 data-vertical:self-auto"
            />
          </>
        ) : null}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage className="line-clamp-1 max-w-60">
                {label}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      {isNotePage && (
        <div className="flex items-center gap-2 px-3" data-tour="sync-status">
          {syncStatus === "saving" && (
            <Badge variant="outline" className="gap-1.5 text-warning">
              <span className="size-1.5 animate-pulse rounded-full bg-current" />
              Saving…
            </Badge>
          )}
          {syncStatus === "offline" && (
            <>
              <Badge variant="outline" className="gap-1.5 text-destructive">
                <span className="size-1.5 rounded-full bg-current" />
                Offline
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                aria-label="Retry sync"
                onClick={() => {
                  if (userId) void syncPending(userId)
                }}
              >
                <RefreshCwIcon className="size-3.5" />
                Retry
              </Button>
            </>
          )}
          {syncStatus === "synced" && (
            <Badge variant="outline" className="gap-1.5 text-success">
              <span className="size-1.5 rounded-full bg-current" />
              Synced
            </Badge>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Note actions"
                data-tour="history"
              >
                <EllipsisIcon className="size-4" />
                <span className="sr-only">Note actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44">
              <DropdownMenuLabel>Note actions</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => setHistoryOpen(true)}>
                <RotateCcwClockIcon className="size-4" />
                History
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {noteId && userId ? (
            <NoteHistory
              userId={userId}
              noteId={noteId}
              showTrigger={false}
              open={historyOpen}
              onOpenChange={setHistoryOpen}
            />
          ) : null}
          <HelpMenu userId={userId} />
        </div>
      )}
      {!isNotePage && (
        <div className="flex items-center gap-2 px-3">
          <HelpMenu userId={userId} />
        </div>
      )}
    </header>
  )
}