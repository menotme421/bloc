"use client";

import * as React from "react";
import type { Editor } from "@tiptap/react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { BLOCK_DEFS, FOLLOW_UP_MAP, type BlockType, type BlockCategory } from "@/lib/blocks/block-config";

type Props = {
  editor: Editor | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slashRange: { from: number; to: number } | null;
};

const FILTER_CHIPS = ["All", "Text", "List", "Media", "Code"] as const;
type FilterChip = typeof FILTER_CHIPS[number];

function getSuggestions(editor: Editor | null): typeof BLOCK_DEFS {
  if (!editor) {
    return BLOCK_DEFS.filter((b) => ["paragraph", "h1", "bulletList", "taskList"].includes(b.id));
  }
  try {
    const { $from } = editor.state.selection;
    const types: string[] = [];
    let pos = $from.pos;
    const doc = editor.state.doc;
    doc.descendants((node, nodePos) => {
      if (nodePos >= pos) return false;
      if (node.isBlock && node.type.name !== "doc") {
        types.push(node.type.name);
      }
      return true;
    });
    const recent = [...new Set(types.slice(-3).reverse())] as BlockType[];
    if (recent.length === 0) {
      return BLOCK_DEFS.filter((b) => ["paragraph", "h1", "bulletList", "taskList"].includes(b.id));
    }
    const suggestedIds = new Set<BlockType>();
    for (const t of recent) {
      const follow = FOLLOW_UP_MAP[t as BlockType] ?? [];
      for (const f of follow) suggestedIds.add(f);
      if (suggestedIds.size >= 4) break;
    }
    const ids = Array.from(suggestedIds).slice(0, 4);
    if (ids.length === 0) {
      return BLOCK_DEFS.filter((b) => ["paragraph", "h1", "bulletList", "taskList"].includes(b.id));
    }
    const mapped = ids.map((id) => BLOCK_DEFS.find((b) => b.id === id)).filter(Boolean) as typeof BLOCK_DEFS;
    return mapped.length ? mapped : BLOCK_DEFS.filter((b) => ["paragraph", "h1", "bulletList", "taskList"].includes(b.id));
  } catch {
    return BLOCK_DEFS.filter((b) => ["paragraph", "h1", "bulletList", "taskList"].includes(b.id));
  }
}

export function BlockPickerSheet({ editor, open, onOpenChange, slashRange }: Props) {
  const savedRangeRef = React.useRef<{ from: number; to: number } | null>(null);
  const [suggestions, setSuggestions] = React.useState<typeof BLOCK_DEFS>([]);
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const [kbOffset, setKbOffset] = React.useState(0);
  const [activeFilter, setActiveFilter] = React.useState<FilterChip>("All");

  // Recompute suggestions on open
  React.useEffect(() => {
    if (open) {
      setSuggestions(getSuggestions(editor));
      setActiveFilter("All");
      savedRangeRef.current = slashRange;
    }
  }, [open, editor, slashRange]);

  // Track visualViewport to keep sheet above keyboard
  React.useEffect(() => {
    if (!open) {
      setKbOffset(0);
      return;
    }
    const vp = window.visualViewport;
    if (!vp) return;
    const update = () => {
      const offset = Math.max(0, window.innerHeight - vp.height - vp.offsetTop);
      setKbOffset(offset);
    };
    vp.addEventListener("resize", update);
    vp.addEventListener("scroll", update);
    update();
    return () => {
      vp.removeEventListener("resize", update);
      vp.removeEventListener("scroll", update);
    };
  }, [open]);

  // Auto-scroll results to top when filter changes
  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [activeFilter]);

  const filtered = React.useMemo(() => {
    if (activeFilter === "All") return BLOCK_DEFS;
    return BLOCK_DEFS.filter((b) => b.category === (activeFilter as BlockCategory));
  }, [activeFilter]);

  const grouped = React.useMemo(() => {
    const map = new Map<string, typeof BLOCK_DEFS>();
    for (const b of filtered) {
      const arr = map.get(b.category) ?? [];
      arr.push(b);
      map.set(b.category, arr);
    }
    return map;
  }, [filtered]);

  const handleInsert = (def: (typeof BLOCK_DEFS)[number]) => {
    if (!editor) return;
    const from = savedRangeRef.current?.from;
    const to = savedRangeRef.current?.to;
    if (from !== undefined && to !== undefined && from !== to) {
      def.insert(editor, from, to);
    } else if (slashRange) {
      def.insert(editor, slashRange.from, slashRange.to);
    } else {
      def.insert(editor);
    }
    onOpenChange(false);
    requestAnimationFrame(() => {
      setTimeout(() => {
        try {
          const { from: after } = editor.state.selection;
          editor.chain().focus().setTextSelection(after).scrollIntoView().run();
        } catch {
          editor.chain().focus().scrollIntoView().run();
        }
      }, 220);
    });
  };

  const handleChipInsert = (def: (typeof BLOCK_DEFS)[number]) => {
    handleInsert(def);
  };

  const showLabels = activeFilter === "All";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex flex-col gap-0 overflow-hidden p-0"
        style={{ maxHeight: `calc(60dvh - ${kbOffset}px)`, paddingBottom: `max(8px, env(safe-area-inset-bottom))` } as React.CSSProperties}
        showCloseButton={false}
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Block picker</SheetTitle>
        </SheetHeader>

        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="h-1.5 w-10 rounded-full bg-muted" />
        </div>

        {/* Suggested row — unchanged, above filter chips */}
        {suggestions.length > 0 && (
          <div className="px-4 pb-2">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Suggested</p>
            <div className="flex gap-2 overflow-x-auto whitespace-nowrap pb-1 scrollbar-none">
              {suggestions.map((s) => {
                const Icon = s.icon;
                return (
                  <Button
                    key={`chip-${s.id}`}
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="min-h-[44px] shrink-0 gap-1.5 whitespace-nowrap touch-auto select-auto"
                    style={{ WebkitUserSelect: "auto", touchAction: "auto" } as React.CSSProperties}
                    onClick={() => handleChipInsert(s)}
                  >
                    <Icon className="size-4" />
                    {s.label}
                  </Button>
                );
              })}
            </div>
          </div>
        )}

        {/* Filter chips — horizontal scrollable */}
        <div className="px-4 pb-3">
          <div className="flex gap-2 overflow-x-auto whitespace-nowrap scrollbar-none">
            {FILTER_CHIPS.map((chip) => (
              <Button
                key={chip}
                type="button"
                variant={activeFilter === chip ? "secondary" : "ghost"}
                size="sm"
                className={`min-h-[44px] shrink-0 touch-auto select-auto ${activeFilter === chip ? "bg-secondary" : ""}`}
                style={{ WebkitUserSelect: "auto", touchAction: "auto" } as React.CSSProperties}
                aria-pressed={activeFilter === chip}
                onClick={() => setActiveFilter(chip)}
              >
                {chip}
              </Button>
            ))}
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pb-4">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No blocks found</p>
          ) : (
            <div className="flex flex-col gap-4">
              {Array.from(grouped.entries()).map(([category, items]) => (
                <div key={category}>
                  {showLabels && <p className="mb-2 text-xs font-medium text-muted-foreground">{category}</p>}
                  <div className="grid grid-cols-2 gap-2">
                    {items.map((def) => {
                      const Icon = def.icon;
                      return (
                        <button
                          key={def.id}
                          type="button"
                          onClick={() => handleInsert(def)}
                          className="flex min-h-[44px] flex-col items-start gap-2 rounded-lg border bg-card p-3 text-left transition-colors hover:bg-accent hover:text-accent-foreground touch-auto select-auto"
                          style={{ WebkitUserSelect: "auto", touchAction: "auto" } as React.CSSProperties}
                        >
                          <span className="flex size-9 items-center justify-center rounded-md bg-muted">
                            <Icon className="size-[18px]" />
                          </span>
                          <span className="flex min-w-0 flex-col">
                            <span className="text-sm font-medium leading-tight">{def.label}</span>
                            <span className="text-xs text-muted-foreground">{def.sublabel}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
