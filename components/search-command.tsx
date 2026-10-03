"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { FileTextIcon, SlidersHorizontalIcon, PencilIcon, Trash2Icon, EllipsisIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  EMPTY_NOTES,
  getAllNotesSnapshot,
  subscribeNotes,
  getLocalNote,
  upsertLocalNote,
  addOutboxEntry,
  removeLocalNote,
  removeOutboxEntry,
  addTombstone,
  removeTombstone,
  getLastNoteId,
  clearLastNoteId,
} from "@/lib/local-notes"
import { syncNote } from "@/lib/note-sync"
import { deleteNote } from "@/app/app/notes/actions"
import { TagChip } from "@/components/tag-chip"
import { filterNotes, getUniqueTags, type DateFilter } from "@/lib/note-filters"
import { FilterBar } from "@/components/note-filters"
import { useI18n } from "@/lib/i18n/provider"
import { openNote } from "@/lib/open-note"



export function SearchCommand({
  open,
  onOpenChange,
  userId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
}) {
  const router = useRouter()
  const { t } = useI18n()
  const [query, setQuery] = React.useState("")
  const [dateFilter, setDateFilter] = React.useState<DateFilter>("all")
  const [tagFilter, setTagFilter] = React.useState<string | null>(null)
  const [filtersOpen, setFiltersOpen] = React.useState(false)
  const [renameId, setRenameId] = React.useState<string | null>(null)
  const [deleteId, setDeleteId] = React.useState<string | null>(null)
  const [draft, setDraft] = React.useState("")

  const notes = React.useSyncExternalStore(
    subscribeNotes,
    () => getAllNotesSnapshot(userId),
    () => EMPTY_NOTES
  )

  const tags = React.useMemo(() => getUniqueTags(notes), [notes])

  const filtered = React.useMemo(
    () => filterNotes(notes, query, dateFilter, tagFilter),
    [notes, query, dateFilter, tagFilter]
  )

  const hasActive = dateFilter !== "all" || tagFilter !== null

  function clearFilters() {
    setDateFilter("all")
    setTagFilter(null)
  }

  React.useEffect(() => {
    if (!open) {
      setQuery("")
      setDateFilter("all")
      setTagFilter(null)
      setFiltersOpen(false)
    }
  }, [open])

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        onOpenChange(!open)
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [open, onOpenChange])

  const renameNote = notes.find((n) => n.id === renameId) ?? null
  const deleteNoteData = notes.find((n) => n.id === deleteId) ?? null

  React.useEffect(() => {
    if (renameNote) setDraft(renameNote.title)
  }, [renameNote])

  function commitRename() {
    if (!renameId || !renameNote) return
    const title = draft.trim()
    if (!title || title === renameNote.title) {
      setRenameId(null)
      return
    }
    const existing = getLocalNote(userId, renameId)
    if (!existing) return
    const updated = { ...existing, title, updated_at: new Date().toISOString() }
    upsertLocalNote(userId, updated)
    addOutboxEntry(userId, { note: updated, mode: "update" })
    void syncNote(userId, updated, "update")
    setRenameId(null)
  }

  function handleDeleteConfirm() {
    if (!deleteId || !deleteNoteData) return
    const id = deleteId
    setDeleteId(null)
    removeLocalNote(userId, id)
    removeOutboxEntry(userId, id)
    addTombstone(userId, id)
    if (getLastNoteId(userId) === id) clearLastNoteId(userId)
    void deleteNote(id).then((result) => {
      if (result.ok) removeTombstone(userId, id)
    })
  }

  return (
    <>
      <CommandDialog open={open} onOpenChange={onOpenChange}>
        <Command shouldFilter={false}>
          <div className="flex items-center gap-2 p-2">
            <div className="flex-1">
              <CommandInput
                placeholder={t("search.placeholder")}
                value={query}
                onValueChange={setQuery}
              />
            </div>
            <Button
              type="button"
              variant={filtersOpen ? "secondary" : "outline"}
              size="icon"
              onClick={() => setFiltersOpen((v) => !v)}
              aria-label={t("search.toggleFilters")}
              className="size-8 shrink-0"
            >
              <SlidersHorizontalIcon className="size-4" />
            </Button>
          </div>
          {filtersOpen && (
            <div className="border-y bg-muted/30 p-3">
              <FilterBar
                dateValue={dateFilter}
                onDateChange={setDateFilter}
                tagValue={tagFilter}
                onTagChange={setTagFilter}
                tags={tags}
                onClear={clearFilters}
                hasActive={hasActive}
              />
            </div>
          )}
          <CommandList>
            <CommandEmpty>{t("search.noNotesFound")}</CommandEmpty>
            {filtered.length > 0 && (
              <CommandGroup heading={`${t("header.notes")} (${filtered.length})`}>
                {filtered.map((note) => (
                  <div key={note.id} className="relative group">
                    <CommandItem
                      value={`${note.title} ${note.tag ?? ""}`}
                      onSelect={() => {
                        openNote(router, note.id)
                        onOpenChange(false)
                      }}
                      className="pr-10"
                    >
                      <FileTextIcon />
                      <span className="min-w-0 flex-1 truncate">
                        {note.title.trim() || t("common.untitled")}
                      </span>
                      {note.tag && <TagChip tag={note.tag} />}
                    </CommandItem>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label="Note actions"
                          className="absolute right-2 top-1/2 flex -translate-y-1/2 size-7 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground opacity-60 hover:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
                        >
                          <EllipsisIcon className="size-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" side="right" className="w-48">
                        <DropdownMenuItem
                          onSelect={() => {
                            setDraft(note.title)
                            setRenameId(note.id)
                          }}
                        >
                          <PencilIcon />
                          {t("notes.rename")}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => setDeleteId(note.id)}
                        >
                          <Trash2Icon />
                          {t("notes.delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </CommandDialog>

      <Dialog open={!!renameId} onOpenChange={(o) => !o && setRenameId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("notes.renameNote")}</DialogTitle>
            <DialogDescription>{t("notes.renameNoteDesc")}</DialogDescription>
          </DialogHeader>
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t("notes.noteTitlePlaceholder")}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename()
              if (e.key === "Escape") setRenameId(null)
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameId(null)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={commitRename} disabled={!draft.trim() || draft.trim() === renameNote?.title}>
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("notes.deleteNoteTitle")}</DialogTitle>
            <DialogDescription>
              {t("notes.deleteNoteDesc", { title: deleteNoteData?.title?.trim() || t("common.untitled") })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              {t("common.cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              {t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
