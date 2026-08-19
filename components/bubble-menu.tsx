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
    apply: (editor) => editor.chain().focus().clearNodes().setParagraph().run(),
    isActive: (editor) => editor.isActive("paragraph"),
  },
  {
    id: "h1",
    label: "Heading 1",
    icon: Heading1Icon,
    apply: (editor) => editor.chain().focus().clearNodes().setHeading({ level: 1 }).run(),
    isActive: (editor) => editor.isActive("heading", { level: 1 }),
  },
  {
    id: "h2",
    label: "Heading 2",
    icon: Heading2Icon,
    apply: (editor) => editor.chain().focus().clearNodes().setHeading({ level: 2 }).run(),
    isActive: (editor) => editor.isActive("heading", { level: 2 }),
  },
  {
    id: "h3",
    label: "Heading 3",
    icon: Heading3Icon,
    apply: (editor) => editor.chain().focus().clearNodes().setHeading({ level: 3 }).run(),
    isActive: (editor) => editor.isActive("heading", { level: 3 }),
  },
  {
    id: "bulletList",
    label: "Bullet List",
    icon: ListIcon,
    apply: (editor) => editor.chain().focus().toggleBulletList().run(),
    isActive: (editor) => editor.isActive("bulletList"),
  },
  {
    id: "orderedList",
    label: "Ordered List",
    icon: ListOrderedIcon,
    apply: (editor) => editor.chain().focus().toggleOrderedList().run(),
    isActive: (editor) => editor.isActive("orderedList"),
  },
  {
    id: "taskList",
    label: "Checklist",
    icon: ListTodoIcon,
    apply: (editor) => editor.chain().focus().toggleTaskList().run(),
    isActive: (editor) => editor.isActive("taskList"),
  },
  {
    id: "blockquote",
    label: "Quote",
    icon: QuoteIcon,
    apply: (editor) => editor.chain().focus().clearNodes().toggleBlockquote().run(),
    isActive: (editor) => editor.isActive("blockquote"),
  },
  {
    id: "codeBlock",
    label: "Code Block",
    icon: Code2Icon,
    apply: (editor) => editor.chain().focus().clearNodes().setCodeBlock().run(),
    isActive: (editor) => editor.isActive("codeBlock"),
  },
];

function ToolbarButton({
  active,
  disabled,
  label,
  onMouseDown,
  onClick,
  children,
  ...rest
}: {
  active?: boolean;
  disabled?: boolean;
  label: string;
  onMouseDown?: React.MouseEventHandler<HTMLButtonElement>;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  children: React.ReactNode;
} & React.ComponentPropsWithoutRef<"button">) {
  return (
    <button
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
          : "hover:bg-secondary"
      )}
    >
      {children}
    </button>
  );
}

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
                : "text-foreground-muted hover:text-foreground"
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
                : "text-foreground-muted hover:text-foreground"
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
                <p className="px-3 py-3 text-sm text-foreground-muted">
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
                  <ExternalLinkIcon className="size-3.5 shrink-0 text-foreground-muted" />
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

  React.useEffect(() => {
    if (!editor) return;
    const t = setInterval(() => {
      if (editor.state.selection.empty) return;
      if (hiddenRef.current) return;
      if (!menuEl || menuEl.isConnected) return;
      setBubbleGen((g) => g + 1);
    }, 800);
    return () => clearInterval(t);
  }, [editor, menuEl]);

  const shouldShow = React.useCallback(
    ({ editor: e }: { editor: Editor }) => {
      const { selection } = e.state;
      if (selection.empty) return false;
      if (e.isActive("codeBlock")) return false;
      return true;
    },
    []
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
      ref={setMenuEl}
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
        onOpenChange={(open) => setOpenPanel(open ? "textColor" : null)}
      >
        <DropdownMenuTrigger asChild>
          <ToolbarButton label="Text color">
            <PaletteIcon
              className="size-4"
              style={{
                color: activeColor,
                textDecoration: activeColor ? undefined : "none",
              }}
            />
          </ToolbarButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top" container={menuEl}>
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
        onOpenChange={(open) => setOpenPanel(open ? "highlight" : null)}
      >
        <DropdownMenuTrigger asChild>
          <ToolbarButton
            label="Highlight color"
            active={Boolean(activeHighlight)}
          >
            <HighlighterIcon className="size-4" />
          </ToolbarButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top" container={menuEl}>
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

      <DropdownMenu
        open={openPanel === "turnInto"}
        onOpenChange={(open) => setOpenPanel(open ? "turnInto" : null)}
      >
        <DropdownMenuTrigger asChild>
          <ToolbarButton label="Turn into">
            <TurnIntoIcon className="size-4" />
            <ChevronDownIcon
              className={cn(
                "-ml-0.5 size-3 text-foreground-muted transition-transform",
                openPanel === "turnInto" && "rotate-180"
              )}
            />
          </ToolbarButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          side="top"
          container={menuEl}
          className="w-max"
        >
          <DropdownMenuGroup>
            {TURN_INTO_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = item.isActive(editor);
              return (
                <DropdownMenuItem
                  key={item.id}
                  onMouseDown={(e) => e.preventDefault()}
                  onSelect={() => {
                    item.apply(editor);
                    setOpenPanel(null);
                  }}
                >
                  <Icon className="size-4 text-foreground-muted" />
                  <span className="flex-1 whitespace-nowrap">{item.label}</span>
                  {active && <CheckIcon className="size-4 text-primary" />}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

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
