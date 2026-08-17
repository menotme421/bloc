"use client"

import * as React from "react"
import { usePathname } from "next/navigation"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"
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

function pageLabel(pathname: string): string | null {
  if (pathname === "/app") return "Home"
  if (pathname === "/app/notes") return "Notes"
  if (pathname === "/app/settings") return "Settings"
  if (pathname.startsWith("/app/notes/")) return "Untitled"
  return "Bloc"
}

export function AppHeader({ userId }: { userId: string }) {
  const pathname = usePathname()
  const isNotePage = pathname.startsWith("/app/notes/")
  const noteId = isNotePage ? pathname.split("/").pop() : null

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

  return (
    <header className="flex h-14 shrink-0 items-center gap-2">
      <div className="flex flex-1 items-center gap-2 px-3">
        <SidebarTrigger />
        <Separator
          orientation="vertical"
          className="mr-2 data-vertical:h-4 data-vertical:self-auto"
        />
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
        <div className="flex items-center gap-2 px-3">
          {syncStatus === "saving" && (
            <span className="badge badge-warning gap-1.5">
              <span className="size-1.5 animate-pulse rounded-full bg-current" />
              Saving…
            </span>
          )}
          {syncStatus === "offline" && (
            <span className="badge badge-destructive gap-1.5">
              <span className="size-1.5 rounded-full bg-current" />
              Offline
            </span>
          )}
          {syncStatus === "synced" && (
            <span className="badge badge-success gap-1.5">
              <span className="size-1.5 rounded-full bg-current" />
              Synced
            </span>
          )}
        </div>
      )}
    </header>
  )
}