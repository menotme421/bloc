"use client";

import * as React from "react";
import type { Editor } from "@tiptap/react";
import { createPortal } from "react-dom";
import {
  ArrowUpIcon,
  ArrowDownIcon,
  CopyIcon,
  Trash2Icon,
  EllipsisVerticalIcon,
  RefreshCwIcon,
  FilesIcon,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { BLOCK_DEFS, TURN_INTO_MAP, type BlockType } from "@/lib/blocks/block-config";
import { convertBlockAtPos } from "@/lib/blocks/convert-block";

type Props = {
  editor: Editor | null;
  isMobile: boolean;
  contentRef: React.RefObject<HTMLDivElement | null>;
};

function findDocBlock($pos: ReturnType<Editor["state"]["doc"]["resolve"]>) {
  // Prefer top-level doc child; handle boundary pos where depth may be 0
  for (let d = 1; d <= $pos.depth; d++) {
    const node = $pos.node(d);
    const parent = d > 0 ? $pos.node(d - 1) : null;
    if (node.isBlock && parent && parent.type.name === "doc") {
      return { node, pos: $pos.before(d), depth: d, $pos };
    }
  }
  // Boundary fallback: pos between blocks or at doc edge (depth 0) — scan doc children
  try {
    const doc = $pos.doc as unknown as { childCount: number; child: (i: number) => { nodeSize: number; isBlock: boolean }; content: { size: number } };
    // Use index(0) to find child at pos; if pos beyond doc, clamp to last child
    const idx = Math.min($pos.index(0), doc.childCount - 1);
    if (idx >= 0 && idx < doc.childCount) {
      let curPos = 0;
      for (let i = 0; i < idx; i++) curPos += doc.child(i).nodeSize;
      const node = doc.child(idx);
      if (node.isBlock) return { node: node as unknown as typeof $pos.node extends (...args: unknown[]) => infer R ? R : never, pos: curPos, depth: 1, $pos };
      // If child not block (should not happen), try neighbors
      if (idx + 1 < doc.childCount) {
        const n2 = doc.child(idx + 1);
        if (n2.isBlock) {
          let p2 = curPos + node.nodeSize;
          return { node: n2 as unknown as typeof $pos.node extends (...args: unknown[]) => infer R ? R : never, pos: p2, depth: 1, $pos };
        }
      }
    }
  } catch {}
  // Fallback: deepest block
  let depth = $pos.depth;
  while (depth > 0) {
    const node = $pos.node(depth);
    if (node.isBlock) return { node, pos: $pos.before(depth), depth, $pos };
    depth--;
  }
  return null;
}

function findBlockAtPos(editor: Editor, domTarget: Element) {
  try {
    const view = editor.view;
    const pos = view.posAtDOM(domTarget as Node, 0);
    const $pos = view.state.doc.resolve(pos);
    const found = findDocBlock($pos);
    if (found) return found;
    // fallback: use current selection block
    const selPos = view.state.selection.from;
    const $sel = view.state.doc.resolve(selPos);
    const selFound = findDocBlock($sel);
    if (selFound) return selFound;
    return null;
  } catch {
    return null;
  }
}

function getBlockType(node: { type: { name: string } }): BlockType | null {
  const name = node.type.name;
  // map tiptap node names to BlockType
  if (name === "paragraph") return "paragraph";
  if (name === "heading") {
    // attribute level distinguishes but we treat as h1/h2/h3 via caller
    return "paragraph"; // will be refined by caller using node.attrs.level
  }
  if (name === "blockquote") return "blockquote";
  if (name === "bulletList") return "bulletList";
  if (name === "orderedList") return "orderedList";
  if (name === "taskList" || name === "taskItem") return "taskList";
  if (name === "codeBlock") return "codeBlock";
  if (name === "horizontalRule") return "horizontalRule";
  if (name === "resource") return "resources";
  if (name === "table") return "table";
  return null;
}

function getCurrentBlockType(editor: Editor, pos: number): BlockType {
  try {
    const $pos = editor.state.doc.resolve(pos);
    const found = findDocBlock($pos);
    if (!found) return "paragraph";
    const node = found.node;
    const depth = found.depth;
    if (node.type.name === "heading") {
      const level = (node.attrs as { level?: number }).level;
      if (level === 1) return "h1";
      if (level === 2) return "h2";
      if (level === 3) return "h3";
    }
    const mapped = getBlockType(node);
    if (mapped) return mapped;
    if (node.type.name === "listItem" || node.type.name === "taskItem") {
      const parent = depth > 1 ? $pos.node(depth - 1) : null;
      if (parent) {
        const p = getBlockType(parent);
        if (p) return p;
      }
    }
    return "paragraph";
  } catch {}
  return "paragraph";
}

export function BlockActionMenu({ editor, isMobile, contentRef }: Props) {
  const [open, setOpen] = React.useState(false);
  const [turnInto, setTurnInto] = React.useState(false);
  const [deleteConfirm, setDeleteConfirm] = React.useState(false);
  const selectedRef = React.useRef<{ pos: number; node: unknown } | null>(null);
  const highlightRef = React.useRef<HTMLElement | null>(null);
  const timerRef = React.useRef<number | null>(null);
  const startRef = React.useRef<{ x: number; y: number } | null>(null);
  const [ellipsisPos, setEllipsisPos] = React.useState<{ top: number; left: number } | null>(null);

  // Update ellipsis button position based on selection
  // Only show handle when not actively typing (hide 800ms after any transaction), and hide when selection empty
  const typingHideRef = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (!editor || !isMobile) return;
    const update = () => {
      try {
        // hide during active typing
        if (typingHideRef.current) window.clearTimeout(typingHideRef.current);
        setEllipsisPos(null);
        typingHideRef.current = window.setTimeout(() => {
          if (!editor.isFocused || editor.state.selection.empty) {
            setEllipsisPos(null);
            return;
          }
          const view = editor.view;
          const { from } = view.state.selection;
          const coords = view.coordsAtPos(from);
          setEllipsisPos({ top: coords.top - 8, left: coords.left });
        }, 800);
      } catch {
        setEllipsisPos(null);
      }
    };
    const immediate = () => {
      if (!editor.isFocused || editor.state.selection.empty) {
        setEllipsisPos(null);
        return;
      }
      try {
        const view = editor.view;
        const { from } = view.state.selection;
        const coords = view.coordsAtPos(from);
        setEllipsisPos({ top: coords.top - 8, left: coords.left });
      } catch {
        setEllipsisPos(null);
      }
    };
    editor.on("selectionUpdate", immediate);
    editor.on("focus", immediate);
    editor.on("blur", () => setEllipsisPos(null));
    editor.on("transaction", update);
    return () => {
      editor.off("selectionUpdate", immediate);
      editor.off("focus", immediate);
      editor.off("blur", () => setEllipsisPos(null));
      editor.off("transaction", update);
      if (typingHideRef.current) window.clearTimeout(typingHideRef.current);
    };
  }, [editor, isMobile]);

  const clearHighlight = React.useCallback(() => {
    if (highlightRef.current) {
      highlightRef.current.classList.remove("bg-accent/20");
      highlightRef.current = null;
    }
  }, []);

  const highlightBlock = React.useCallback((dom: HTMLElement) => {
    clearHighlight();
    dom.classList.add("bg-accent/20");
    highlightRef.current = dom;
  }, [clearHighlight]);

  React.useEffect(() => {
    return () => clearHighlight();
  }, [clearHighlight]);

  React.useEffect(() => {
    if (!open) {
      setTurnInto(false);
      setDeleteConfirm(false);
      // clear highlight on close
      setTimeout(clearHighlight, 150);
    }
  }, [open, clearHighlight]);

  const handleOpenAtPos = React.useCallback((pos: number, dom: HTMLElement | null) => {
    selectedRef.current = { pos, node: null };
    if (dom) highlightBlock(dom);
    setOpen(true);
    if (navigator.vibrate) navigator.vibrate(30);
  }, [highlightBlock]);

  const handleLongPressTrigger = React.useCallback((e: PointerEvent, target: Element) => {
    if (!editor) return;
    const res = findBlockAtPos(editor, target);
    if (!res) return;
    // find DOM element for highlight - walk up to nearest block-level element with data
    let dom: HTMLElement | null = target as HTMLElement;
    while (dom && dom !== contentRef.current) {
      if (dom.matches?.("p, h1, h2, h3, blockquote, ul, ol, li, pre, hr, table, div[data-type='resource']")) {
        break;
      }
      dom = dom.parentElement;
    }
    if (!dom || dom === contentRef.current) {
      // fallback to target
      dom = target as HTMLElement;
    }
    handleOpenAtPos(res.pos, dom);
  }, [editor, contentRef, handleOpenAtPos]);

  // Toolbar drag handle → open menu at current selection
  React.useEffect(() => {
    if (!isMobile || !editor) return;
    const handler = () => {
      try {
        const from = editor.state.selection.from;
        const $pos = editor.state.doc.resolve(from);
        const found = findDocBlock($pos);
        const pos = found ? found.pos : from;
        const dom = editor.view.domAtPos(pos).node.parentElement as HTMLElement | null;
        handleOpenAtPos(pos, dom);
      } catch {}
    };
    window.addEventListener("bloc:open-block-menu" as unknown as string, handler as EventListener);
    return () => window.removeEventListener("bloc:open-block-menu" as unknown as string, handler as EventListener);
  }, [isMobile, editor, handleOpenAtPos]);

  // BUG-A: long press disabled — block menu only via drag handle
  React.useEffect(() => {
    return;
  }, [isMobile, editor, contentRef, handleLongPressTrigger]);

  // Dismiss on tap outside / editor body tap (sheet handles outside, but also editor tap)
  React.useEffect(() => {
    if (!open || !contentRef.current) return;
    const onTap = (e: MouseEvent) => {
      const target = e.target as Element;
      if (contentRef.current?.contains(target)) {
        // tap inside editor body closes menu? spec says tap editor body closes
        // but we already have sheet overlay handling. Keep for direct tap.
        // Only close if not on ellipsis button
        if (!target.closest("[data-slot='sheet-content']")) {
          // don't auto-close on every editor tap, only if sheet is open and user taps editor
          // Let sheet's onOpenChange handle outside click
        }
      }
    };
    document.addEventListener("click", onTap);
    return () => document.removeEventListener("click", onTap);
  }, [open, contentRef]);

  const currentPos = selectedRef.current?.pos ?? editor?.state.selection.from ?? 0;
  const currentType = editor ? getCurrentBlockType(editor, currentPos) : "paragraph";

  // Turn into filtering — must be before early return to keep hooks order
  const turnIntoOptions = React.useMemo(() => {
    if (!editor) return [];
    const allowed = TURN_INTO_MAP[currentType as BlockType] ?? [];
    return BLOCK_DEFS.filter((d) => allowed.includes(d.id as BlockType) && d.id !== currentType);
  }, [editor, currentType]);

  const doScrollAndFocus = (pos: number) => {
    if (!editor) return;
    editor.chain().focus().setTextSelection(pos).scrollIntoView().run();
  };

  const actions = {
    moveUp: () => {
      console.log("[block-action] tap moveUp", selectedRef.current?.pos);
      if (!editor || selectedRef.current == null) return;
      let pos = selectedRef.current.pos;
      try {
        let doc = editor.state.doc;
        if (pos < 0 || pos >= doc.content.size) {
          const $cur = doc.resolve(editor.state.selection.from);
          const cur = findDocBlock($cur);
          if (!cur) return;
          pos = cur.pos;
        }
        const $pos = doc.resolve(Math.min(pos, Math.max(0, doc.content.size - 2)));
        const found = findDocBlock($pos);
        if (!found) { console.log("[block-action] moveUp early return !found", { pos, mappedPos: Math.min(pos, Math.max(0, doc.content.size - 2)), docSize: doc.content.size }); return; }
        const { pos: blockPos, node: blockNode } = found;
        const blockEnd = blockPos + blockNode.nodeSize;
        if (blockPos === 0) { console.log("[block-action] moveUp early return blockPos===0", { blockPos }); return; }
        const $prev = doc.resolve(Math.max(0, blockPos - 1));
        const prevFound = findDocBlock($prev);
        if (!prevFound) { console.log("[block-action] moveUp early return !prevFound", { blockPos, prevPos: Math.max(0, blockPos - 1) }); return; }
        const prevPos = prevFound.pos;
        const prevNode = prevFound.node;
        const blockSlice = doc.slice(blockPos, blockEnd);
        const prevSlice = doc.slice(prevPos, prevPos + prevNode.nodeSize);
        const tr = editor.state.tr.replaceWith(prevPos, blockEnd, blockSlice.content.append(prevSlice.content));
        const newPos = prevPos;
        setOpen(false);
        // Dispatch after sheet starts closing to avoid focus trap race
        setTimeout(() => {
          editor.view.dispatch(tr);
          console.log("[block-action] dispatch moveUp", { prevPos, blockPos, blockEnd, docSize: doc.content.size });
          const ok = editor.chain().focus().setTextSelection(newPos + 1).scrollIntoView().run();
          console.log("[block-action] result moveUp", ok, { newPos, selection: editor.state.selection.from });
          selectedRef.current = { pos: newPos, node: null };
        }, 10);
      } catch (e) {
        console.error("[moveUp]", e);
        setOpen(false);
      }
    },
    moveDown: () => {
      console.log("[block-action] tap moveDown", selectedRef.current?.pos);
      if (!editor || selectedRef.current == null) return;
      let pos = selectedRef.current.pos;
      try {
        let doc = editor.state.doc;
        if (pos < 0 || pos >= doc.content.size) {
          const $cur = doc.resolve(editor.state.selection.from);
          const cur = findDocBlock($cur);
          if (!cur) return;
          pos = cur.pos;
        }
        const $pos = doc.resolve(Math.min(pos, Math.max(0, doc.content.size - 2)));
        const found = findDocBlock($pos);
        if (!found) { console.log("[block-action] moveDown early return !found", { pos }); return; }
        const { pos: blockPos, node: blockNode } = found;
        const blockEnd = blockPos + blockNode.nodeSize;
        if (blockEnd >= doc.content.size) { console.log("[block-action] moveDown early return at end", { blockEnd, docSize: doc.content.size }); return; }
        const $next = doc.resolve(Math.min(blockEnd + 1, doc.content.size - 1));
        const nextFound = findDocBlock($next);
        if (!nextFound) { console.log("[block-action] moveDown early return !nextFound", { blockEnd }); return; }
        const nextPos = nextFound.pos;
        const nextNode = nextFound.node;
        const blockSlice = doc.slice(blockPos, blockEnd);
        const nextSlice = doc.slice(nextPos, nextPos + nextNode.nodeSize);
        const tr = editor.state.tr.replaceWith(blockPos, nextPos + nextNode.nodeSize, nextSlice.content.append(blockSlice.content));
        const newPos = blockPos + nextNode.nodeSize;
        setOpen(false);
        setTimeout(() => {
          editor.view.dispatch(tr);
          console.log("[block-action] dispatch moveDown", { blockPos, nextPos, blockEnd, docSize: doc.content.size });
          const ok = editor.chain().focus().setTextSelection(newPos + 1).scrollIntoView().run();
          console.log("[block-action] result moveDown", ok, { newPos, selection: editor.state.selection.from });
          selectedRef.current = { pos: newPos, node: null };
        }, 10);
      } catch (e) {
        console.error("[moveDown]", e);
        setOpen(false);
      }
    },
    duplicate: () => {
      console.log("[block-action] tap duplicate", selectedRef.current?.pos);
      if (!editor || selectedRef.current == null) { console.log("[block-action] duplicate early return no selectedRef"); return; }
      let pos = selectedRef.current.pos;
      try {
        const doc = editor.state.doc;
        if (pos < 0 || pos >= doc.content.size) {
          const $cur = doc.resolve(editor.state.selection.from);
          const cur = findDocBlock($cur);
          if (!cur) { console.log("[block-action] duplicate early return !cur", { pos, docSize: doc.content.size }); return; }
          pos = cur.pos;
        }
        const $pos = doc.resolve(Math.min(pos, Math.max(0, doc.content.size - 2)));
        const found = findDocBlock($pos);
        if (!found) { console.log("[block-action] duplicate early return !found", { pos }); return; }
        const { pos: blockPos, node: blockNode } = found;
        const blockEnd = blockPos + blockNode.nodeSize;
        const slice = doc.slice(blockPos, blockEnd);
        const tr = editor.state.tr.insert(blockEnd, slice.content);
        setOpen(false);
        setTimeout(() => {
          editor.view.dispatch(tr);
          console.log("[block-action] dispatch duplicate", { blockPos, blockEnd, docSize: doc.content.size });
          const ok = editor.chain().focus().setTextSelection(blockEnd + 1).scrollIntoView().run();
          console.log("[block-action] result duplicate", ok, { blockEnd, selection: editor.state.selection.from });
        }, 10);
      } catch (e) {
        console.error("[duplicate]", e);
        setOpen(false);
      }
    },
    delete: () => {
      console.log("[block-action] tap delete", selectedRef.current?.pos);
      if (!editor || selectedRef.current == null) { console.log("[block-action] delete early return no selectedRef"); return; }
      let pos = selectedRef.current.pos;
      try {
        const doc = editor.state.doc;
        if (pos < 0 || pos >= doc.content.size) {
          const $cur = doc.resolve(editor.state.selection.from);
          const cur = findDocBlock($cur);
          if (!cur) { console.log("[block-action] delete early return !cur", { pos }); return; }
          pos = cur.pos;
        }
        const $pos = doc.resolve(Math.min(pos, Math.max(0, doc.content.size - 2)));
        const found = findDocBlock($pos);
        if (!found) { console.log("[block-action] delete early return !found", { pos }); return; }
        const { pos: blockPos, node: blockNode } = found;
        const blockEnd = blockPos + blockNode.nodeSize;
        const tr = editor.state.tr.delete(blockPos, blockEnd);
        setOpen(false);
        setTimeout(() => {
          editor.view.dispatch(tr);
          console.log("[block-action] dispatch delete", { blockPos, blockEnd, docSize: doc.content.size });
          const ok = editor.chain().focus().scrollIntoView().run();
          console.log("[block-action] result delete", ok, { selection: editor.state.selection.from });
        }, 10);
      } catch (e) {
        console.error("[delete]", e);
        setOpen(false);
      }
    },
  };

  if (!isMobile || !editor) return null;

  const handleTurnInto = (def: typeof BLOCK_DEFS[number]) => {
    if (!editor || selectedRef.current == null) return;
    const pos = selectedRef.current.pos;
    console.log("[block-action] tap turnInto", { pos, def: def.id });
    try {
      // Single-transaction convert handles list<->list and list->text correctly
      // via clearNodes + toggle/set in one chain with clamped selection.
      const ok = convertBlockAtPos(editor, pos, def.id as BlockType);
      console.log("[block-action] turnInto convert", { def: def.id, ok });
      if (!ok) {
        // Fallback: try direct insert (e.g. table/resource)
        def.insert(editor, undefined, undefined);
      }
    } catch (e) {
      console.error("[block-action] turnInto failed", e);
      try { def.insert(editor, undefined, undefined); } catch {}
    }
    setTurnInto(false);
    setOpen(false);
  };

  return (
    <>
      {/* Accessibility ellipsis button - appears on block focus on mobile */}
      {ellipsisPos && !open && (
        <div
          className="fixed z-30 md:hidden"
          style={{ top: ellipsisPos.top, left: ellipsisPos.left - 8, transform: "translateX(-100%)" }}
        >
          <Button
            type="button"
            variant="secondary"
            size="icon-sm"
            aria-label="Block actions"
            className="size-7 rounded-full shadow-md"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              if (!editor) return;
              const from = editor.state.selection.from;
              const $pos = editor.state.doc.resolve(from);
              const found = findDocBlock($pos);
              const pos = found ? found.pos : from;
              const dom = editor.view.domAtPos(pos).node.parentElement as HTMLElement | null;
              handleOpenAtPos(pos, dom);
            }}
          >
            <EllipsisVerticalIcon className="size-4" />
          </Button>
        </div>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="flex max-h-[70vh] flex-col gap-0 overflow-hidden p-0"
          showCloseButton={false}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Block actions</SheetTitle>
          </SheetHeader>

          <div className="flex justify-center pt-3 pb-2">
            <div className="h-1.5 w-10 rounded-full bg-muted" />
          </div>

          <div className="flex-1 overflow-y-auto">
            {turnInto ? (
              <div className="p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setTurnInto(false)} className="min-h-[44px] touch-auto select-auto" style={{ WebkitUserSelect: "auto", touchAction: "auto" } as React.CSSProperties}>
                    ← Back
                  </Button>
                  <span className="text-sm font-medium">Turn into…</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {turnIntoOptions.length === 0 ? (
                    <p className="col-span-2 py-6 text-center text-sm text-muted-foreground">No convertible blocks</p>
                  ) : (
                    turnIntoOptions.map((def) => {
                      const Icon = def.icon;
                      return (
                        <button
                          key={def.id}
                          type="button"
                          onClick={() => handleTurnInto(def)}
                          className="flex min-h-[44px] flex-col items-start gap-2 rounded-lg border bg-card p-3 text-left hover:bg-accent hover:text-accent-foreground touch-auto select-auto"
                          style={{ WebkitUserSelect: "auto", touchAction: "auto" } as React.CSSProperties}
                        >
                          <span className="flex size-9 items-center justify-center rounded-md bg-muted">
                            <Icon className="size-[18px]" />
                          </span>
                          <span className="flex flex-col">
                            <span className="text-sm font-medium">{def.label}</span>
                            <span className="text-xs text-muted-foreground">{def.sublabel}</span>
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            ) : deleteConfirm ? (
              <div className="p-4">
                <p className="mb-4 text-center text-sm font-medium">Delete this block?</p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 min-h-[44px] touch-auto select-auto"
                    style={{ WebkitUserSelect: "auto", touchAction: "auto" } as React.CSSProperties}
                    onClick={() => setDeleteConfirm(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    className="flex-1 min-h-[44px] touch-auto select-auto"
                    style={{ WebkitUserSelect: "auto", touchAction: "auto" } as React.CSSProperties}
                    onClick={() => {
                      setDeleteConfirm(false);
                      actions.delete();
                    }}
                  >
                    Confirm
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-1 p-2">
                <button
                  type="button"
                  onClick={() => setTurnInto(true)}
                  className="flex min-h-[44px] items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium hover:bg-accent hover:text-accent-foreground touch-auto select-auto"
                  style={{ WebkitUserSelect: "auto", touchAction: "auto" } as React.CSSProperties}
                >
                  <RefreshCwIcon className="size-4" />
                  Turn into…
                </button>
                <button
                  type="button"
                  onClick={actions.moveUp}
                  className="flex min-h-[44px] items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium hover:bg-accent hover:text-accent-foreground touch-auto select-auto"
                  style={{ WebkitUserSelect: "auto", touchAction: "auto" } as React.CSSProperties}
                >
                  <ArrowUpIcon className="size-4" />
                  Move up
                </button>
                <button
                  type="button"
                  onClick={actions.moveDown}
                  className="flex min-h-[44px] items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium hover:bg-accent hover:text-accent-foreground touch-auto select-auto"
                  style={{ WebkitUserSelect: "auto", touchAction: "auto" } as React.CSSProperties}
                >
                  <ArrowDownIcon className="size-4" />
                  Move down
                </button>
                <button
                  type="button"
                  onClick={actions.duplicate}
                  className="flex min-h-[44px] items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium hover:bg-accent hover:text-accent-foreground touch-auto select-auto"
                  style={{ WebkitUserSelect: "auto", touchAction: "auto" } as React.CSSProperties}
                >
                  <FilesIcon className="size-4" />
                  Duplicate
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(true)}
                  className="flex min-h-[44px] items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium text-destructive hover:bg-destructive/10 touch-auto select-auto"
                  style={{ WebkitUserSelect: "auto", touchAction: "auto" } as React.CSSProperties}
                >
                  <Trash2Icon className="size-4" />
                  Delete
                </button>
              </div>
            )}
          </div>

          {!turnInto && !deleteConfirm && (
            <div className="border-t p-3">
              <Button
                type="button"
                variant="outline"
                className="w-full min-h-[44px] touch-auto select-auto"
                style={{ WebkitUserSelect: "auto", touchAction: "auto" } as React.CSSProperties}
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
