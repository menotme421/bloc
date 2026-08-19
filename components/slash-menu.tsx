"use client";

import * as React from "react";
import type { Editor } from "@tiptap/react";
import {
  Code2Icon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ListIcon,
  ListOrderedIcon,
  ListTodoIcon,
  MinusIcon,
  QuoteIcon,
  ShapesIcon,
  TableIcon,
  TypeIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

export type SlashMenuController = {
  onKeyDown(event: KeyboardEvent): boolean;
};

export type SlashMenuState = {
  query: string;
  index: number;
  from: number;
  to: number;
  top: number;
  left: number;
};

type SlashItem = {
  id: string;
  label: string;
  aliases: string[];
  icon: React.ComponentType<{ className?: string }>;
  apply(editor: Editor, from: number, to: number): void;
};

export const SLASH_ITEMS: SlashItem[] = [
  {
    id: "paragraph",
    label: "Paragraph",
    aliases: ["text", "plain", "p"],
    icon: TypeIcon,
    apply: (editor, from, to) => {
      editor.chain().focus().deleteRange({ from, to }).setParagraph().run();
    },
  },
  {
    id: "h1",
    label: "Heading 1",
    aliases: ["h1", "heading 1", "title"],
    icon: Heading1Icon,
    apply: (editor, from, to) => {
      editor
        .chain()
        .focus()
        .deleteRange({ from, to })
        .setHeading({ level: 1 })
        .run();
    },
  },
  {
    id: "h2",
    label: "Heading 2",
    aliases: ["h2", "heading 2", "subtitle"],
    icon: Heading2Icon,
    apply: (editor, from, to) => {
      editor
        .chain()
        .focus()
        .deleteRange({ from, to })
        .setHeading({ level: 2 })
        .run();
    },
  },
  {
    id: "h3",
    label: "Heading 3",
    aliases: ["h3", "heading 3"],
    icon: Heading3Icon,
    apply: (editor, from, to) => {
      editor
        .chain()
        .focus()
        .deleteRange({ from, to })
        .setHeading({ level: 3 })
        .run();
    },
  },
  {
    id: "bulletList",
    label: "Bullet List",
    aliases: ["bullet", "bulleted", "ul", "list"],
    icon: ListIcon,
    apply: (editor, from, to) => {
      editor.chain().focus().deleteRange({ from, to }).toggleBulletList().run();
    },
  },
  {
    id: "orderedList",
    label: "Ordered List",
    aliases: ["ordered", "ol", "numbered", "number"],
    icon: ListOrderedIcon,
    apply: (editor, from, to) => {
      editor
        .chain()
        .focus()
        .deleteRange({ from, to })
        .toggleOrderedList()
        .run();
    },
  },
  {
    id: "taskList",
    label: "Checklist",
    aliases: ["task", "todo", "check", "checkbox"],
    icon: ListTodoIcon,
    apply: (editor, from, to) => {
      editor.chain().focus().deleteRange({ from, to }).toggleTaskList().run();
    },
  },
  {
    id: "blockquote",
    label: "Quote",
    aliases: ["quote", "blockquote"],
    icon: QuoteIcon,
    apply: (editor, from, to) => {
      editor.chain().focus().deleteRange({ from, to }).toggleBlockquote().run();
    },
  },
  {
    id: "codeBlock",
    label: "Code Block",
    aliases: ["code", "pre", "code block"],
    icon: Code2Icon,
    apply: (editor, from, to) => {
      editor.chain().focus().deleteRange({ from, to }).setCodeBlock().run();
    },
  },
  {
    id: "table",
    label: "Table",
    aliases: ["table", "tab", "grid", "rows", "columns"],
    icon: TableIcon,
    apply: (editor, from, to) => {
      if (editor.isActive("tableCell") || editor.isActive("tableHeader")) {
        return;
      }
      editor
        .chain()
        .focus()
        .deleteRange({ from, to })
        .insertTable({ rows: 2, cols: 3, withHeaderRow: true })
        .run();
    },
  },
  {
    id: "horizontalRule",
    label: "Divider",
    aliases: ["divider", "hr", "line", "separator", "rule"],
    icon: MinusIcon,
    apply: (editor, from, to) => {
      editor
        .chain()
        .focus()
        .deleteRange({ from, to })
        .setHorizontalRule()
        .run();
    },
  },
  {
    id: "resources",
    label: "Resources",
    aliases: ["resource", "file", "files", "upload", "attachment", "image", "media"],
    icon: ShapesIcon,
    apply: (editor, from, to) => {
      editor
        .chain()
        .focus()
        .deleteRange({ from, to })
        .insertContent({ type: "resource" })
        .run();
    },
  },
];

function filterItems(query: string): SlashItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return SLASH_ITEMS;
  return SLASH_ITEMS.filter(
    (item) =>
      item.label.toLowerCase().includes(q) ||
      item.aliases.some((alias) => alias.toLowerCase().startsWith(q))
  );
}

function computeSlashState(editor: Editor): Omit<SlashMenuState, "index"> | null {
  const { selection } = editor.state;
  if (!selection.empty) return null;
  const { $from } = selection;
  if (!$from.parent.isTextblock) return null;

  const textBefore = $from.parent.textBetween(0, $from.parentOffset);
  const match = /(^|\s)\/(\S*)$/.exec(textBefore);
  if (!match) return null;

  const slashIdx = textBefore.lastIndexOf("/");
  if (slashIdx < 0) return null;

  const coords = editor.view.coordsAtPos($from.pos);
  return {
    query: match[2],
    from: $from.start() + slashIdx,
    to: $from.pos,
    top: coords.bottom + 6,
    left: coords.left,
  };
}

export function SlashMenu({
  editor,
  controllerRef,
}: {
  editor: Editor | null;
  controllerRef: React.RefObject<SlashMenuController | null>;
}) {
  const [menu, setMenu] = React.useState<SlashMenuState | null>(null);
  const menuRef = React.useRef<SlashMenuState | null>(null);
  const indexRef = React.useRef(0);
  const listRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    menuRef.current = menu;
  }, [menu]);

  React.useEffect(() => {
    const list = listRef.current;
    if (!list || !menu) return;
    const active = list.querySelector<HTMLElement>(
      `[data-index="${menu.index}"]`
    );
    active?.scrollIntoView({ block: "nearest" });
  }, [menu]);

  React.useEffect(() => {
    if (!editor) return;

    const close = () => setMenu(null);

    const onTransaction = () => {
      const next = computeSlashState(editor);
      if (!next) {
        indexRef.current = 0;
        setMenu(null);
        return;
      }
      setMenu((current) => {
        const filtered = filterItems(next.query);
        const index =
          !current || current.query !== next.query
            ? 0
            : current.index >= filtered.length
              ? 0
              : current.index;
        indexRef.current = index;
        return { ...next, index };
      });
    };

    const controller: SlashMenuController = {
      onKeyDown(event) {
        if (event.isComposing) return false;
        const current = menuRef.current;
        if (!current) return false;

        if (event.key === "Escape") {
          indexRef.current = 0;
          setMenu(null);
          return true;
        }

        const filtered = filterItems(current.query);
        const count = Math.max(filtered.length, 1);

        if (event.key === "ArrowDown" || event.key === "Tab") {
          event.preventDefault();
          const next = (indexRef.current + 1) % count;
          indexRef.current = next;
          setMenu({ ...current, index: next });
          return true;
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          const next = (indexRef.current - 1 + count) % count;
          indexRef.current = next;
          setMenu({ ...current, index: next });
          return true;
        }
        if (event.key === "Enter") {
          const item = filtered[indexRef.current];
          if (!item) {
            indexRef.current = 0;
            setMenu(null);
            return false;
          }
          event.preventDefault();
          item.apply(editor, current.from, current.to);
          indexRef.current = 0;
          setMenu(null);
          return true;
        }
        return false;
      },
    };

    controllerRef.current = controller;
    editor.on("transaction", onTransaction);
    editor.on("blur", close);

    return () => {
      controllerRef.current = null;
      editor.off("transaction", onTransaction);
      editor.off("blur", close);
    };
  }, [editor, controllerRef]);

  if (!menu) return null;

  const filtered = filterItems(menu.query);

  return (
    <div
      ref={listRef}
      role="menu"
      className="fixed z-50 min-w-56 overflow-y-auto rounded-lg border border-border/60 bg-popover p-1 shadow-lg"
      style={{ top: menu.top, left: menu.left, maxHeight: 288 }}
    >
      {filtered.length === 0 && (
        <p className="px-3 py-1.5 text-sm text-foreground-muted">
          No results
        </p>
      )}
      {filtered.map((item, i) => {
        const Icon = item.icon;
        const active = i === menu.index;
        return (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            data-index={i}
            onMouseDown={(e) => e.preventDefault()}
            onMouseEnter={() => {
              indexRef.current = i;
              setMenu((m) => (m ? { ...m, index: i } : m));
            }}
            onClick={() => {
              if (!editor) return;
              const current = menuRef.current;
              if (!current) return;
              item.apply(editor, current.from, current.to);
              setMenu(null);
            }}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-md px-3 py-1.5 text-left text-sm transition-colors",
              active
                ? "bg-secondary text-secondary-foreground"
                : "text-foreground"
            )}
          >
            <Icon className="size-4 shrink-0 text-foreground-muted" />
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}