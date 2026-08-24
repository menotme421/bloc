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
import { HistoryIcon, HomeIcon, FileTextIcon } from "lucide-react"
import { EMPTY_NOTES, getAllNotesSnapshot, subscribeNotes } from "@/lib/local-notes"
import { TagChip } from "@/components/tag-chip"
import { filterNotes, getUniqueTags, type DateFilter } from "@/lib/note-filters"
import { FilterBar } from "@/components/note-filters"
import { useI18n } from "@/lib/i18n/provider"



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

  const navItems = [
    { title: t("header.home"), url: "/app/home", icon: <HomeIcon /> },
    { title: t("nav.recent"), url: undefined, icon: <HistoryIcon /> },
  ]

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

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <Command shouldFilter={false}>
        <CommandInput
          placeholder={t("search.placeholder")}
          value={query}
          onValueChange={setQuery}
        />
        <div className="border-t bg-muted/30 p-3">
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
        <CommandList>
          <CommandEmpty>{t("search.noNotesFound")}</CommandEmpty>
          <CommandGroup heading={t("search.title")}>
            {navItems.map((item) => (
              <CommandItem
                key={item.title}
                value={item.title}
                onSelect={() => {
                  if (item.url) {
                    router.push(item.url)
                  }
                  onOpenChange(false)
                }}
              >
                {item.icon}
                <span>{item.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
          {filtered.length > 0 && (
            <CommandGroup heading={`${t("header.notes")} (${filtered.length})`}>
              {filtered.map((note) => (
                <CommandItem
                  key={note.id}
                  value={`${note.title} ${note.tag ?? ""}`}
                  onSelect={() => {
                    router.push(`/app/notes/${note.id}`)
                    onOpenChange(false)
                  }}
                >
                  <FileTextIcon />
                  <span className="min-w-0 flex-1 truncate">
                    {note.title.trim() || t("common.untitled")}
                  </span>
                  {note.tag && <TagChip tag={note.tag} />}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  )
}