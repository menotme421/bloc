"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { EllipsisIcon, FileTextIcon, PencilIcon, Trash2Icon } from "lucide-react"

import { deleteNote } from "@/app/app/notes/actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarInput,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
  addOutboxEntry,
  addTombstone,
  clearLastNoteId,
  getLastNoteId,
  getLocalNote,
  removeLocalNote,
  removeOutboxEntry,
  removeTombstone,
  upsertLocalNote,
} from "@/lib/local-notes"
import { syncNote } from "@/lib/note-sync"
import type { Note } from "@/lib/notes"

export function NoteSidebarItem({
  userId,
  note,
}: {
  userId: string
  note: Note
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [renaming, setRenaming] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [draft, setDraft] = React.useState(note.title)
  const url = `/app/notes/${note.id}`
  const isActive = pathname === url

  function commitRename() {
    setRenaming(false)
    const title = draft.trim()
    if (!title || title === note.title) return
    const existing = getLocalNote(userId, note.id)
    if (!existing) return
    const updated: Note = {
      ...existing,
      title,
      updated_at: new Date().toISOString(),
    }
    upsertLocalNote(userId, updated)
    addOutboxEntry(userId, { note: updated, mode: "update" })
    void syncNote(userId, updated, "update")
  }

  function handleDelete() {
    setDeleteOpen(false)
    removeLocalNote(userId, note.id)
    removeOutboxEntry(userId, note.id)
    addTombstone(userId, note.id)
    if (getLastNoteId(userId) === note.id) {
      clearLastNoteId(userId)
    }
    if (isActive) {
      router.replace("/app/notes")
    }
    void deleteNote(note.id).then((result) => {
      if (result.ok) {
        removeTombstone(userId, note.id)
      }
    })
  }

  return (
    <SidebarMenuItem>
      {renaming ? (
        <SidebarMenuButton className="font-normal">
          <FileTextIcon />
          <SidebarInput
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
            className="h-6 px-1"
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename()
              if (e.key === "Escape") setRenaming(false)
            }}
            onBlur={commitRename}
          />
        </SidebarMenuButton>
      ) : (
        <SidebarMenuButton asChild isActive={isActive} className="font-normal">
          <a href={url}>
            <FileTextIcon />
            <span>{note.title.trim() || "Untitled"}</span>
          </a>
        </SidebarMenuButton>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction showOnHover aria-label="Note actions">
            <EllipsisIcon />
          </SidebarMenuAction>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start">
          <DropdownMenuItem
            onSelect={() => {
              setDraft(note.title)
              setRenaming(true)
            }}
          >
            <PencilIcon />
            Rename
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setDeleteOpen(true)}
          >
            <Trash2Icon />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete note?</DialogTitle>
            <DialogDescription>
              &quot;{note.title.trim() || "Untitled"}&quot; will be permanently
              deleted. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarMenuItem>
  )
}