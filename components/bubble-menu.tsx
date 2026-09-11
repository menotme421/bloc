"use client";

import * as React from "react";
import { BubbleMenu as TiptapBubbleMenu } from "@tiptap/react/menus";
import type { Editor } from "@tiptap/react";
import {
  BoldIcon,
  CheckIcon,
  ChevronDownIcon,
  Code2Icon,
  ExternalLinkIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  HighlighterIcon,
  ItalicIcon,
  Link2Icon,
  Link2OffIcon,
  ListIcon,
  ListOrderedIcon,
  ListTodoIcon,
  PaletteIcon,
  QuoteIcon,
  StrikethroughIcon,
  SubscriptIcon,
  SuperscriptIcon,
  TypeIcon,
  UnderlineIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { getLocalNotes } from "@/lib/local-notes";
import { convertBlock } from "@/lib/blocks/convert-block";
import type { BlockType } from "@/lib/blocks/block-config";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

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

const TURN_INTO_ITEMS: {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  apply(editor: Editor): void;
  isActive(editor: Editor): boolean;
}[] = [
  {
    id: "paragraph",
    label: "Paragraph",
    icon: TypeIcon,
    apply: (editor) => {
      const ok = convertBlock(editor, "paragraph" as BlockType);
      console.log("[bubble] turnInto paragraph", ok);
    },
    isActive: (editor) => editor.isActive("paragraph"),
  },
  {
    id: "h1",
    label: "Heading 1",
    icon: Heading1Icon,
    apply: (editor) => {
      const ok = convertBlock(editor, "h1" as BlockType);
      console.log("[bubble] turnInto h1", ok);
    },
    isActive: (editor) => editor.isActive("heading", { level: 1 }),
  },
  {
    id: "h2",
    label: "Heading 2",
    icon: Heading2Icon,
    apply: (editor) => {
      const ok = convertBlock(editor, "h2" as BlockType);
      console.log("[bubble] turnInto h2", ok);
    },
    isActive: (editor) => editor.isActive("heading", { level: 2 }),
  },
  {
    id: "h3",
    label: "Heading 3",
    icon: Heading3Icon,
    apply: (editor) => {
      const ok = convertBlock(editor, "h3" as BlockType);
      console.log("[bubble] turnInto h3", ok);
    },
    isActive: (editor) => editor.isActive("heading", { level: 3 }),
  },
  {
    id: "bulletList",
    label: "Bullet List",
    icon: ListIcon,
    apply: (editor) => {
      const ok = convertBlock(editor, "bulletList" as BlockType);
      console.log("[bubble] turnInto bulletList", ok);
    },
    isActive: (editor) => editor.isActive("bulletList"),
  },
  {
    id: "orderedList",
    label: "Ordered List",
    icon: ListOrderedIcon,
    apply: (editor) => {
      const ok = convertBlock(editor, "orderedList" as BlockType);
      console.log("[bubble] turnInto orderedList", ok);
    },
    isActive: (editor) => editor.isActive("orderedList"),
  },
  {
    id: "taskList",
    label: "Checklist",
    icon: ListTodoIcon,
    apply: (editor) => {
      const ok = convertBlock(editor, "taskList" as BlockType);
      console.log("[bubble] turnInto taskList", ok);
    },
    isActive: (editor) => editor.isActive("taskList"),
  },
  {
    id: "blockquote",
    label: "Quote",
    icon: QuoteIcon,
    apply: (editor) => {
      const ok = convertBlock(editor, "blockquote" as BlockType);
      console.log("[bubble] turnInto blockquote", ok);
    },
    isActive: (editor) => editor.isActive("blockquote"),
  },
  {
    id: "codeBlock",
    label: "Code Block",
    icon: Code2Icon,
    apply: (editor) => {
      const ok = convertBlock(editor, "codeBlock" as BlockType);
      console.log("[bubble] turnInto codeBlock", ok);
    },
    isActive: (editor) => editor.isActive("codeBlock"),
  },
];

const ToolbarButton = React.forwardRef<
  HTMLButtonElement,
  {
    active?: boolean;
    disabled?: boolean;
    label: string;
    onMouseDown?: React.MouseEventHandler<HTMLButtonElement>;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    children: React.ReactNode;
  } & React.ComponentPropsWithoutRef<"button">
>(function ToolbarButton(
  { active, disabled, label, onMouseDown, onClick, children, className, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onMouseDown={onMouseDown ?? ((e) => e.preventDefault())}
      onClick={onClick}
      {...rest}
      className={cn(
        "flex size-7 items-center justify-center rounded-md text-foreground transition-colors",
        active
          ? "bg-secondary text-secondary-foreground"
          : "hover:bg-secondary",
        className
      )}
    >
      {children}
    </button>
  );
});

function ColorSwatch({
  color,
  label,
  active,
  onSelect,
}: {
  color: string;
  label: string;
  active?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onSelect}
      className={cn(
        "flex size-7 items-center justify-center rounded-md border border-border/60 transition-transform hover:scale-110",
        active && "ring-2 ring-primary"
      )}
      style={{ backgroundColor: color }}
    >
      {active && <CheckIcon className="size-3.5 text-foreground" />}
    </button>
  );
}

function LinkDialog({
  editor,
  userId,
  initialUrl,
  open,
  onOpenChange,
}: {
  editor: Editor;
  userId: string;
  initialUrl: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [tab, setTab] = React.useState<"url" | "note">("url");
  const [url, setUrl] = React.useState(initialUrl);
  const [query, setQuery] = React.useState("");

  const notes = React.useMemo(
    () => getLocalNotes(userId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, query, open]
  );

  const filteredNotes = notes.filter(
    (n) =>
      n.id !== (typeof window !== "undefined" ? window.location.pathname.split("/").pop() : undefined) &&
      (n.title || n.content).toLowerCase().includes(query.toLowerCase())
  );

  function applyLink(href: string) {
    const value = href.trim();
    if (!value) return;
    if (/^(https?:\/\/|\/)/i.test(value)) {
      editor.chain().focus().setLink({ href: value }).run();
    } else {
      editor.chain().focus().setLink({ href: `https://${value}` }).run();
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add link</DialogTitle>
          <DialogDescription>
            Link to a URL or another note in your workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setTab("url")}
            className={cn(
              "rounded-md px-2.5 py-1 text-sm transition-colors",
              tab === "url"
                ? "bg-secondary text-secondary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            URL
          </button>
          <button
            type="button"
            onClick={() => setTab("note")}
            className={cn(
              "rounded-md px-2.5 py-1 text-sm transition-colors",
              tab === "note"
                ? "bg-secondary text-secondary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Note
          </button>
        </div>

        {tab === "url" ? (
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              applyLink(url);
            }}
          >
            <Input
              autoFocus
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
            />
            <DialogFooter>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={!url.trim()}>
                Apply
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="flex flex-col gap-3">
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search notesâ€¦"
            />
            <div className="max-h-56 overflow-y-auto rounded-md border border-border/60">
              {filteredNotes.length === 0 && (
                <p className="px-3 py-3 text-sm text-muted-foreground">
                  No notes found.
                </p>
              )}
              {filteredNotes.map((note) => (
                <button
                  key={note.id}
                  type="button"
                  onClick={() => {
                    applyLink(`/app/notes/${note.id}`);
                  }}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-secondary"
                >
                  <span className="truncate">
                    {note.title.trim() || "Untitled"}
                  </span>
                  <ExternalLinkIcon className="size-3.5 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function BubbleMenu({
  editor,
  userId,
}: {
  editor: Editor | null;
  userId: string;
}) {
  const [linkOpen, setLinkOpen] = React.useState(false);
  const [openPanel, setOpenPanel] = React.useState<
    "textColor" | "highlight" | "turnInto" | null
  >(null);
  const [menuEl, setMenuEl] = React.useState<HTMLDivElement | null>(null);
  const [bubbleGen, setBubbleGen] = React.useState(0);
  const hiddenRef = React.useRef(false);
  const menuRef = React.useRef<HTMLDivElement | null>(null);

  React.useLayoutEffect(() => {
    if (menuRef.current !== menuEl) {
      setMenuEl(menuRef.current);
    }
  }, [bubbleGen, menuEl]);

  React.useEffect(() => {
    if (!editor) return;
    const t = setInterval(() => {
      // Never remount while a dropdown panel is open — that would unmount
      // the open menu and swallow the click (no console log, menu just closes).
      if (openPanel) return;
      if (editor.state.selection.empty) return;
      if (hiddenRef.current) return;
      if (!menuEl || menuEl.isConnected) return;
      setBubbleGen((g) => g + 1);
    }, 800);
    return () => clearInterval(t);
  }, [editor, menuEl, openPanel]);

  const shouldShow = React.useCallback(
    ({ editor: e }: { editor: Editor }) => {
      // Keep bubble visible while color/turnInto dropdown is open (focus moves to portal)
      if (openPanel) return true;
      const { selection } = e.state;
      if (selection.empty) return false;
      if (e.isActive("codeBlock")) return false;
      return true;
    },
    [openPanel]
  );

  const menuOptions = React.useMemo(
    () => ({
      placement: "top" as const,
      offset: 8,
      onHide: () => {
        hiddenRef.current = true;
        setOpenPanel(null);
      },
      onShow: () => {
        hiddenRef.current = false;
      },
    }),
    []
  );

  if (!editor) return null;

  const linkActive = editor.isActive("link");
  const activeColor = editor.getAttributes("textStyle").color as
    | string
    | undefined;
  const activeHighlight = editor
    .getAttributes("highlight")
    .color as string | undefined;
  const anchorBlock = editor.state.selection.$from.node(1);
  const activeTurnIntoItem = TURN_INTO_ITEMS.find((item) => {
    const name = anchorBlock?.type.name;
    if (name === "heading") return item.id === "h" + anchorBlock.attrs.level;
    return name === item.id;
  });
  const TurnIntoIcon = activeTurnIntoItem?.icon ?? TypeIcon;

  return (
    <TiptapBubbleMenu
      key={bubbleGen}
      ref={(el) => {
        menuRef.current = el;
      }}
      editor={editor}
      pluginKey="bubbleMenu"
      updateDelay={0}
      options={menuOptions}
      shouldShow={shouldShow}
      className="flex items-center gap-0.5 rounded-lg border border-border/60 bg-popover p-1 shadow-lg"
    >
      <ToolbarButton
        label="Bold (Ctrl+B)"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <BoldIcon className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Italic (Ctrl+I)"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <ItalicIcon className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Underline (Ctrl+U)"
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Strikethrough (Ctrl+Shift+X)"
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <StrikethroughIcon className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Inline code"
        active={editor.isActive("code")}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        <Code2Icon className="size-4" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-5" />

      <ToolbarButton
        label="Superscript (Ctrl+.)"
        active={editor.isActive("superscript")}
        onClick={() =>
          editor.chain().focus().unsetSubscript().toggleSuperscript().run()
        }
      >
        <SuperscriptIcon className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Subscript (Ctrl+,)"
        active={editor.isActive("subscript")}
        onClick={() =>
          editor.chain().focus().unsetSuperscript().toggleSubscript().run()
        }
      >
        <SubscriptIcon className="size-4" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-5" />

      <DropdownMenu
        open={openPanel === "textColor"}
        onOpenChange={(open) => {
          console.log("[bubble] textColor dropdown", open);
          setOpenPanel(open ? "textColor" : null);
        }}
      >
        <DropdownMenuTrigger asChild>
          <ToolbarButton label="Text color" onMouseDown={(e) => e.stopPropagation()}>
            <PaletteIcon
              className="size-4"
              style={{
                color: activeColor,
                textDecoration: activeColor ? undefined : "none",
              }}
            />
          </ToolbarButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top">
          <DropdownMenuLabel>Text color</DropdownMenuLabel>
          <div className="flex flex-wrap gap-1 px-1.5 py-1">
            {TEXT_COLORS.map(({ name, value }) => (
              <ColorSwatch
                key={name}
                color={value}
                label={name === "Default" ? "Default color" : name}
                active={name === "Default" ? !activeColor : activeColor === value}
                onSelect={() => {
                  if (name === "Default") {
                    editor.chain().focus().unsetColor().run();
                  } else {
                    editor.chain().focus().setColor(value).run();
                  }
                  setOpenPanel(null);
                }}
              />
            ))}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu
        open={openPanel === "highlight"}
        onOpenChange={(open) => {
          console.log("[bubble] highlight dropdown", open);
          setOpenPanel(open ? "highlight" : null);
        }}
      >
        <DropdownMenuTrigger asChild>
          <ToolbarButton
            label="Highlight color"
            active={Boolean(activeHighlight)}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <HighlighterIcon className="size-4" />
          </ToolbarButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top">
          <DropdownMenuLabel>Highlight color</DropdownMenuLabel>
          <div className="flex flex-wrap gap-1 px-1.5 py-1">
            {HIGHLIGHT_COLORS.map(({ name, value }) => (
              <ColorSwatch
                key={name}
                color={value}
                label={name === "None" ? "No highlight" : `${name} highlight`}
                active={
                  name === "None" ? !activeHighlight : activeHighlight === value
                }
                onSelect={() => {
                  if (name === "None") {
                    editor.chain().focus().unsetHighlight().run();
                  } else {
                    editor.chain().focus().setHighlight({ color: value }).run();
                  }
                  setOpenPanel(null);
                }}
              />
            ))}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Turn-into uses an inline panel (not Radix) on purpose: Radix portals
          steal editor focus and the Tiptap hide race swallows item clicks
          (dropdown opens but onSelect never fires). Plain buttons with
          onMouseDown={preventDefault} keep the selection — same pattern as
          the Bold/Italic buttons above, which work reliably. */}
      <div className="relative">
        <ToolbarButton
          label="Turn into"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            console.log("[bubble] turnInto toggle", openPanel);
            setOpenPanel(openPanel === "turnInto" ? null : "turnInto");
          }}
        >
          <TurnIntoIcon className="size-4" />
          <ChevronDownIcon
            className={cn(
              "-ml-0.5 size-3 text-muted-foreground transition-transform",
              openPanel === "turnInto" && "rotate-180"
            )}
          />
        </ToolbarButton>
        {openPanel === "turnInto" && (
          <div
            role="menu"
            className="absolute top-full left-0 z-50 mt-2 w-max rounded-md bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10"
          >
            {TURN_INTO_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = item.isActive(editor);
              return (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  data-testid={`turn-into-${item.id}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    console.log("[bubble] turnInto select", item.id, {
                      from: editor.state.selection.from,
                      to: editor.state.selection.to,
                      empty: editor.state.selection.empty,
                    });
                    try {
                      item.apply(editor);
                    } catch (err) {
                      console.error("[bubble] turnInto apply error", item.id, err);
                    }
                    setOpenPanel(null);
                  }}
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none hover:bg-accent hover:text-accent-foreground"
                >
                  <Icon className="size-4 text-muted-foreground" />
                  <span className="flex-1 whitespace-nowrap">{item.label}</span>
                  {active && <CheckIcon className="size-4 text-primary" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <Separator orientation="vertical" className="mx-1 h-5" />

      <ToolbarButton
        label={linkActive ? "Edit link" : "Add link"}
        active={linkActive}
        onClick={() => setLinkOpen(true)}
      >
        <Link2Icon className="size-4" />
      </ToolbarButton>
      {linkActive && (
        <ToolbarButton
          label="Remove link"
          onClick={() => editor.chain().focus().unsetLink().run()}
        >
          <Link2OffIcon className="size-4" />
        </ToolbarButton>
      )}

      <LinkDialog
        key={linkOpen ? "open" : "closed"}
        editor={editor}
        userId={userId}
        initialUrl={
          (editor.getAttributes("link").href ?? "").toString().startsWith(
            "/app/notes/"
          )
            ? ""
            : (editor.getAttributes("link").href ?? "").toString()
        }
        open={linkOpen}
        onOpenChange={setLinkOpen}
      />
    </TiptapBubbleMenu>
  );
}
