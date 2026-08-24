"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/react";
import {
  BoldIcon,
  ItalicIcon,
  UnderlineIcon,
  StrikethroughIcon,
  SuperscriptIcon,
  SubscriptIcon,
  PaletteIcon,
  HighlighterIcon,
  Link2Icon,
  CheckIcon,
  ExternalLinkIcon,
  GripVerticalIcon,
  SquareSlash,
  Code2Icon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { getLocalNotes } from "@/lib/local-notes";

type Props = {
  editor: Editor | null;
  isMobile: boolean;
  onAddBlock: () => void;
  userId?: string;
};

const TEXT_COLORS: { name: string; value: string }[] = [
  { name: "Default", value: "#ffffff" },
  { name: "Red", value: "#f87171" },
  { name: "Orange", value: "#fb923c" },
  { name: "Amber", value: "#fbbf24" },
  { name: "Green", value: "#4ade80" },
  { name: "Teal", value: "#2dd4bf" },
  { name: "Blue", value: "#60a5fa" },
  { name: "Violet", value: "#a78bfa" },
  { name: "Purple", value: "#c084fc" },
  { name: "Pink", value: "#f472b6" },
  { name: "Slate", value: "#94a3b8" },
];

const HIGHLIGHT_COLORS: { name: string; value: string }[] = [
  { name: "None", value: "#ffffff" },
  { name: "Yellow", value: "#fde047" },
  { name: "Green", value: "#86efac" },
  { name: "Blue", value: "#93c5fd" },
  { name: "Pink", value: "#f9a8d4" },
  { name: "Red", value: "#fca5a5" },
  { name: "Orange", value: "#fdba74" },
  { name: "Purple", value: "#d8b4fe" },
];

function ColorSwatch({ color, label, active, onSelect }: { color: string; label: string; active?: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onSelect}
      className={cn("flex size-7 shrink-0 aspect-square items-center justify-center rounded-md border border-border/60 transition-transform hover:scale-110", active && "ring-2 ring-primary")}
      style={{ backgroundColor: color }}
    >
      {active && <CheckIcon className="size-3.5 text-foreground shrink-0" />}
    </button>
  );
}

export function MiniToolbar({ editor, isMobile, onAddBlock, userId }: Props) {
  const [focused, setFocused] = React.useState(false);
  const [kbOffset, setKbOffset] = React.useState(0);
  const [, force] = React.useReducer((x: number) => x + 1, 0);
  const [expanded, setExpanded] = React.useState<"text" | "highlight" | null>(null);
  const [linkOpen, setLinkOpen] = React.useState(false);
  const [linkUrl, setLinkUrl] = React.useState("");
  const [linkQuery, setLinkQuery] = React.useState("");
  const [linkTab, setLinkTab] = React.useState<"url" | "note">("url");

  // focus + selection tracking — no delay (selectionUpdate + transaction)
  React.useEffect(() => {
    if (!editor) return;
    const onFocus = () => { setFocused(true); force(); };
    const onBlur = () => { setFocused(false); force(); };
    const onSel = () => force();
    const onTxn = () => force();
    editor.on("focus", onFocus);
    editor.on("blur", onBlur);
    editor.on("selectionUpdate", onSel);
    editor.on("transaction", onTxn);
    setFocused(editor.isFocused);
    return () => {
      editor.off("focus", onFocus);
      editor.off("blur", onBlur);
      editor.off("selectionUpdate", onSel);
      editor.off("transaction", onTxn);
    };
  }, [editor]);

  // visualViewport keyboard tracking — keep while toolbar or any sheet is open
  const anySheetOpen = !!expanded || linkOpen;
  const showToolbar = focused || anySheetOpen;
  React.useEffect(() => {
    if (!isMobile || (!focused && !anySheetOpen)) {
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
  }, [isMobile, focused, anySheetOpen]);

  const hasSelection = !!editor && !editor.state.selection.empty;

  const ensureInlineSelection = React.useCallback(() => {
    if (!editor) return false;
    try {
      const { from, to } = editor.state.selection;
      if (from === to) return false;
      const $from = editor.state.doc.resolve(from);
      const $to = editor.state.doc.resolve(to);
      if ($from.parent.inlineContent && $to.parent.inlineContent) return true;
      let newFrom = from, newTo = to;
      for (let p = from; p < to && p < editor.state.doc.content.size; p++) {
        try { if (editor.state.doc.resolve(p).parent.inlineContent) { newFrom = p; break; } } catch {}
      }
      for (let p = to; p > from && p > 0; p--) {
        try { if (editor.state.doc.resolve(p).parent.inlineContent) { newTo = p; break; } } catch {}
      }
      if (newFrom !== from || newTo !== to) {
        const ok = editor.chain().setTextSelection({ from: newFrom, to: newTo }).run();
        console.log("[mini-toolbar] ensureInlineSelection adjusted", { from, to, newFrom, newTo, ok });
        return ok;
      }
      return true;
    } catch (e) {
      console.warn("[mini-toolbar] ensureInlineSelection failed", e);
      return false;
    }
  }, [editor]);

  if (!isMobile || !editor) return null;
  if (!showToolbar && !anySheetOpen) return null;

  const btnBase = "min-h-[44px] min-w-[44px] size-11 shrink-0";
  const activeCls = "bg-accent text-accent-foreground";
  const isBold = editor.isActive("bold");
  const isItalic = editor.isActive("italic");
  const isUnderline = editor.isActive("underline");
  const isStrike = editor.isActive("strike");
  const isCode = editor.isActive("code");
  const isSuperscript = editor.isActive("superscript");
  const isSubscript = editor.isActive("subscript");
  const linkActive = editor.isActive("link");
  const activeColor = editor.getAttributes("textStyle").color as string | undefined;
  const activeHighlight = editor.getAttributes("highlight").color as string | undefined;

  const openLink = () => {
    console.log("[mini-toolbar] tap link", {
      hasSelection,
      linkActive,
      focused,
      from: editor.state.selection.from,
      to: editor.state.selection.to,
      empty: editor.state.selection.empty,
      textBetween: (() => { try { return editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, " "); } catch { return ""; } })(),
      activeColor,
      activeHighlight,
    });
    // Normalize selection to inline before opening link sheet (fixes blockquote TextSelection error)
    ensureInlineSelection();
    const href = (editor.getAttributes("link").href as string) ?? "";
    const isInternal = href.startsWith("/app/notes/");
    setLinkUrl(isInternal ? "" : href);
    setLinkQuery("");
    setLinkTab("url");
    setLinkOpen(true);
    console.log("[mini-toolbar] after openLink setLinkOpen true", { linkOpen: true, hasSelection });
  };
  const applyLink = (href: string) => {
    const v = href.trim();
    if (!v) return;
    ensureInlineSelection();
    if (/^(https?:\/\/|\/)/i.test(v)) editor.chain().focus().setLink({ href: v }).run();
    else editor.chain().focus().setLink({ href: `https://${v}` }).run();
    setLinkOpen(false);
    setTimeout(() => editor.chain().focus().run(), 50);
  };
  const notes = userId ? getLocalNotes(userId) : [];
  const filteredNotes = notes.filter((n) => (n.title || n.content).toLowerCase().includes(linkQuery.toLowerCase())).slice(0, 8);

  const handleBlockMenu = () => {
    window.dispatchEvent(new CustomEvent("bloc:open-block-menu"));
  };
  const handleSlash = () => {
    (document.activeElement as HTMLElement | null)?.blur();
    editor.commands.blur();
    onAddBlock();
  };

  const content = (
    <>
      <div
        data-slot="mini-toolbar"
        className="fixed inset-x-0 z-40 flex flex-col bg-popover shadow-lg border-t"
        style={{ bottom: kbOffset, paddingBottom: `max(4px, env(safe-area-inset-bottom))` }}
      >
        {/* Second layer — slides up when hasSelection, inline swatches slide from icon */}
        <div
          className={cn(
            "flex items-center gap-1 px-2 overflow-hidden border-b bg-popover w-full box-border transition-all duration-300 ease-in-out",
            hasSelection ? "max-h-14 py-1 opacity-100 translate-y-0" : "max-h-0 py-0 opacity-0 -translate-y-2 pointer-events-none"
          )}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Text color"
            className={`${btnBase} shrink-0 ${activeColor ? activeCls : ""} ${expanded === "text" ? "bg-accent text-accent-foreground" : ""}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setExpanded(expanded === "text" ? null : "text")}
          >
            <PaletteIcon className="size-4" style={{ color: activeColor }} />
          </Button>
          <div
            className={cn(
              "flex items-center gap-2 overflow-x-auto scrollbar-none p-1 transition-all duration-300 ease-out",
              expanded === "text" ? "flex-1 min-w-0 max-w-[55vw] opacity-100 ml-1" : "max-w-0 opacity-0 pointer-events-none"
            )}
            style={{ scrollbarWidth: "none" } as React.CSSProperties}
          >
            {TEXT_COLORS.map(({ name, value }) => (
              <ColorSwatch key={name} color={value} label={name} active={name === "Default" ? !activeColor : activeColor === value} onSelect={() => { ensureInlineSelection(); if (name === "Default") editor.chain().focus().unsetColor().run(); else editor.chain().focus().setColor(value).run(); setExpanded(null); }} />
            ))}
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Background color"
            className={`${btnBase} shrink-0 ${activeHighlight ? activeCls : ""} ${expanded === "highlight" ? "bg-accent text-accent-foreground" : ""}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setExpanded(expanded === "highlight" ? null : "highlight")}
          >
            <HighlighterIcon className="size-4" />
          </Button>
          <div
            className={cn(
              "flex items-center gap-2 overflow-x-auto scrollbar-none p-1 transition-all duration-300 ease-out",
              expanded === "highlight" ? "flex-1 min-w-0 max-w-[55vw] opacity-100 ml-1" : "max-w-0 opacity-0 pointer-events-none"
            )}
            style={{ scrollbarWidth: "none" } as React.CSSProperties}
          >
            {HIGHLIGHT_COLORS.map(({ name, value }) => (
              <ColorSwatch key={name} color={value} label={name} active={name === "None" ? !activeHighlight : activeHighlight === value} onSelect={() => { ensureInlineSelection(); if (name === "None") editor.chain().focus().unsetHighlight().run(); else editor.chain().focus().setHighlight({ color: value }).run(); setExpanded(null); }} />
            ))}
          </div>

          <Button type="button" variant={linkActive ? "secondary" : "ghost"} size="icon" aria-label="Add link" className={`${btnBase} shrink-0 ${linkActive ? activeCls : ""}`} onMouseDown={(e) => e.preventDefault()} onClick={openLink}>
            <Link2Icon className="size-4" />
          </Button>
          {expanded && (
            <Button type="button" variant="ghost" size="sm" onMouseDown={(e) => e.preventDefault()} onClick={() => setExpanded(null)} className="shrink-0 ml-1">
              ✕
            </Button>
          )}
        </div>

        {/* Base layer — scrollable 6 + fixed right */}
        <div className="flex items-center gap-0 w-full">
          <div className="flex flex-1 items-center gap-1 overflow-x-auto scrollbar-none px-2 py-1" style={{ scrollbarWidth: "none" }}>
            <Button type="button" variant={isBold ? "secondary" : "ghost"} size="icon" aria-label="Bold" aria-pressed={isBold} className={`${btnBase} ${isBold ? activeCls : ""}`} onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleBold().run()}>
              <BoldIcon className="size-4" />
            </Button>
            <Button type="button" variant={isItalic ? "secondary" : "ghost"} size="icon" aria-label="Italic" aria-pressed={isItalic} className={`${btnBase} ${isItalic ? activeCls : ""}`} onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleItalic().run()}>
              <ItalicIcon className="size-4" />
            </Button>
            <Button type="button" variant={isUnderline ? "secondary" : "ghost"} size="icon" aria-label="Underline" aria-pressed={isUnderline} className={`${btnBase} ${isUnderline ? activeCls : ""}`} onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleUnderline().run()}>
              <UnderlineIcon className="size-4" />
            </Button>
            <Button type="button" variant={isStrike ? "secondary" : "ghost"} size="icon" aria-label="Strikethrough" aria-pressed={isStrike} className={`${btnBase} ${isStrike ? activeCls : ""}`} onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleStrike().run()}>
              <StrikethroughIcon className="size-4" />
            </Button>
            <Button type="button" variant={isCode ? "secondary" : "ghost"} size="icon" aria-label="Inline code" aria-pressed={isCode} className={`${btnBase} ${isCode ? activeCls : ""}`} onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleCode().run()}>
              <Code2Icon className="size-4" />
            </Button>
            <Button type="button" variant={isSuperscript ? "secondary" : "ghost"} size="icon" aria-label="Superscript" aria-pressed={isSuperscript} className={`${btnBase} ${isSuperscript ? activeCls : ""}`} onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().unsetSubscript().toggleSuperscript().run()}>
              <SuperscriptIcon className="size-4" />
            </Button>
            <Button type="button" variant={isSubscript ? "secondary" : "ghost"} size="icon" aria-label="Subscript" aria-pressed={isSubscript} className={`${btnBase} ${isSubscript ? activeCls : ""}`} onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().unsetSuperscript().toggleSubscript().run()}>
              <SubscriptIcon className="size-4" />
            </Button>
          </div>
          <div className="flex shrink-0 items-center gap-1 border-l bg-popover px-2 py-1 shadow-[-4px_0_12px_rgba(0,0,0,0.08)]">
            <Button type="button" variant="ghost" size="icon" aria-label="Block menu" className={`${btnBase}`} onMouseDown={(e) => e.preventDefault()} onClick={handleBlockMenu}>
              <GripVerticalIcon className="size-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon" aria-label="Add block" className={`${btnBase}`} onMouseDown={(e) => e.preventDefault()} onClick={handleSlash}>
              <SquareSlash className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Link sheet — keep keyboard after dismiss, above keyboard */}
      <Sheet open={linkOpen} onOpenChange={(o) => { if (!o) { setLinkOpen(false); setTimeout(() => editor.chain().focus().run(), 80); } else setLinkOpen(o); }}>
        <SheetContent side="bottom" className="flex flex-col p-4" style={{ maxHeight: `calc(60dvh - ${kbOffset}px)`, bottom: kbOffset } as React.CSSProperties} onCloseAutoFocus={(e) => { e.preventDefault(); editor.chain().focus().run(); }}>
          <SheetHeader className="sr-only"><SheetTitle>Add link</SheetTitle></SheetHeader>
          <p className="mb-3 text-sm font-medium">Add link</p>
          <div className="flex gap-1.5 mb-3">
            <button type="button" onClick={() => setLinkTab("url")} className={cn("rounded-md px-2.5 py-1 text-sm", linkTab === "url" ? "bg-secondary text-secondary-foreground" : "text-muted-foreground")}>URL</button>
            <button type="button" onClick={() => setLinkTab("note")} className={cn("rounded-md px-2.5 py-1 text-sm", linkTab === "note" ? "bg-secondary text-secondary-foreground" : "text-muted-foreground")}>Note</button>
          </div>
          {linkTab === "url" ? (
            <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); applyLink(linkUrl); }}>
              <Input autoFocus value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://example.com" />
              <Button type="submit" disabled={!linkUrl.trim()} className="w-full">Apply</Button>
              {linkActive && <Button type="button" variant="ghost" className="w-full" onClick={() => { editor.chain().focus().unsetLink().run(); setLinkOpen(false); }}>Remove link</Button>}
            </form>
          ) : (
            <div className="flex flex-col gap-3">
              <Input autoFocus value={linkQuery} onChange={(e) => setLinkQuery(e.target.value)} placeholder="Search notes…" />
              <div className="max-h-56 overflow-y-auto rounded-md border">
                {filteredNotes.length === 0 ? <p className="px-3 py-3 text-sm text-muted-foreground">No notes found.</p> : filteredNotes.map((n) => (
                  <button key={n.id} type="button" onClick={() => applyLink(`/app/notes/${n.id}`)} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-secondary"><span className="truncate">{n.title.trim() || "Untitled"}</span><ExternalLinkIcon className="size-3.5 shrink-0 text-muted-foreground" /></button>
                ))}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );

  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}
