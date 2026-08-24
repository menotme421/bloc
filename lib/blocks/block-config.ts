"use client";

import type { Editor } from "@tiptap/react";
import {
  TypeIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  QuoteIcon,
  ListIcon,
  ListOrderedIcon,
  ListTodoIcon,
  ShapesIcon,
  MinusIcon,
  Code2Icon,
  TableIcon,
  InfoIcon,
} from "lucide-react";

export type BlockCategory = "Text" | "List" | "Media" | "Code" | "Advanced";

export type BlockType =
  | "paragraph"
  | "h1"
  | "h2"
  | "h3"
  | "blockquote"
  | "bulletList"
  | "orderedList"
  | "taskList"
  | "resources"
  | "horizontalRule"
  | "codeBlock"
  | "table"
  | "callout";

export type BlockDef = {
  id: BlockType;
  label: string;
  sublabel: string;
  category: BlockCategory;
  icon: React.ComponentType<{ className?: string }>;
  aliases: string[];
  insert: (editor: Editor, from?: number, to?: number) => void;
};

export const BLOCK_DEFS: BlockDef[] = [
  {
    id: "paragraph",
    label: "Paragraph",
    sublabel: "Plain text block",
    category: "Text",
    icon: TypeIcon,
    aliases: ["text", "plain", "p", "paragraph"],
    insert: (editor, from, to) => {
      if (from !== undefined && to !== undefined) {
        editor.chain().focus().deleteRange({ from, to }).setParagraph().run();
      } else {
        editor.chain().focus().setParagraph().run();
      }
    },
  },
  {
    id: "h1",
    label: "Heading 1",
    sublabel: "Big section title",
    category: "Text",
    icon: Heading1Icon,
    aliases: ["h1", "heading 1", "title"],
    insert: (editor, from, to) => {
      const chain = editor.chain().focus();
      if (from !== undefined && to !== undefined) chain.deleteRange({ from, to });
      chain.setHeading({ level: 1 }).run();
    },
  },
  {
    id: "h2",
    label: "Heading 2",
    sublabel: "Medium section title",
    category: "Text",
    icon: Heading2Icon,
    aliases: ["h2", "heading 2", "subtitle"],
    insert: (editor, from, to) => {
      const chain = editor.chain().focus();
      if (from !== undefined && to !== undefined) chain.deleteRange({ from, to });
      chain.setHeading({ level: 2 }).run();
    },
  },
  {
    id: "h3",
    label: "Heading 3",
    sublabel: "Small section title",
    category: "Text",
    icon: Heading3Icon,
    aliases: ["h3", "heading 3"],
    insert: (editor, from, to) => {
      const chain = editor.chain().focus();
      if (from !== undefined && to !== undefined) chain.deleteRange({ from, to });
      chain.setHeading({ level: 3 }).run();
    },
  },
  {
    id: "blockquote",
    label: "Quote",
    sublabel: "Blockquote",
    category: "Text",
    icon: QuoteIcon,
    aliases: ["quote", "blockquote"],
    insert: (editor, from, to) => {
      const chain = editor.chain().focus();
      if (from !== undefined && to !== undefined) chain.deleteRange({ from, to });
      chain.toggleBlockquote().run();
    },
  },
  {
    id: "bulletList",
    label: "Bullet List",
    sublabel: "Bulleted list",
    category: "List",
    icon: ListIcon,
    aliases: ["bullet", "bulleted", "ul", "list"],
    insert: (editor, from, to) => {
      const chain = editor.chain().focus();
      if (from !== undefined && to !== undefined) chain.deleteRange({ from, to });
      chain.toggleBulletList().run();
    },
  },
  {
    id: "orderedList",
    label: "Ordered List",
    sublabel: "Numbered list",
    category: "List",
    icon: ListOrderedIcon,
    aliases: ["ordered", "ol", "numbered", "number"],
    insert: (editor, from, to) => {
      const chain = editor.chain().focus();
      if (from !== undefined && to !== undefined) chain.deleteRange({ from, to });
      chain.toggleOrderedList().run();
    },
  },
  {
    id: "taskList",
    label: "Todo list",
    sublabel: "Checklist with boxes",
    category: "List",
    icon: ListTodoIcon,
    aliases: ["task", "todo", "check", "checkbox"],
    insert: (editor, from, to) => {
      const chain = editor.chain().focus();
      if (from !== undefined && to !== undefined) chain.deleteRange({ from, to });
      chain.toggleTaskList().run();
    },
  },
  {
    id: "resources",
    label: "Image",
    sublabel: "Upload image or file",
    category: "Media",
    icon: ShapesIcon,
    aliases: ["resource", "image", "media", "file", "upload"],
    insert: (editor, from, to) => {
      const chain = editor.chain().focus();
      if (from !== undefined && to !== undefined) chain.deleteRange({ from, to });
      chain.insertContent({ type: "resource" }).run();
    },
  },
  {
    id: "horizontalRule",
    label: "Divider",
    sublabel: "Horizontal rule",
    category: "Media",
    icon: MinusIcon,
    aliases: ["divider", "hr", "line", "separator", "rule"],
    insert: (editor, from, to) => {
      const chain = editor.chain().focus();
      if (from !== undefined && to !== undefined) chain.deleteRange({ from, to });
      chain.setHorizontalRule().run();
    },
  },
  {
    id: "codeBlock",
    label: "Code Block",
    sublabel: "Code with highlighting",
    category: "Code",
    icon: Code2Icon,
    aliases: ["code", "pre", "code block"],
    insert: (editor, from, to) => {
      const chain = editor.chain().focus();
      if (from !== undefined && to !== undefined) chain.deleteRange({ from, to });
      chain.setCodeBlock().run();
    },
  },
  {
    id: "table",
    label: "Table",
    sublabel: "2x3 table",
    category: "Advanced",
    icon: TableIcon,
    aliases: ["table", "grid", "rows", "columns"],
    insert: (editor, from, to) => {
      if (editor.isActive("tableCell") || editor.isActive("tableHeader")) return;
      const chain = editor.chain().focus();
      if (from !== undefined && to !== undefined) chain.deleteRange({ from, to });
      chain.insertTable({ rows: 2, cols: 3, withHeaderRow: true }).run();
    },
  },
  {
    id: "callout",
    label: "Callout",
    sublabel: "Info block",
    category: "Advanced",
    icon: InfoIcon,
    aliases: ["callout", "info", "alert"],
    insert: (editor, from, to) => {
      const chain = editor.chain().focus();
      if (from !== undefined && to !== undefined) chain.deleteRange({ from, to });
      // fallback to blockquote as callout if not supported
      chain.toggleBlockquote().run();
    },
  },
];

// Follow-up suggestions: heading -> [bullet, h2, paragraph] etc.
export const FOLLOW_UP_MAP: Record<BlockType, BlockType[]> = {
  paragraph: ["h1", "bulletList", "taskList", "blockquote"],
  h1: ["h2", "bulletList", "paragraph"],
  h2: ["h3", "bulletList", "paragraph"],
  h3: ["bulletList", "paragraph", "blockquote"],
  blockquote: ["paragraph", "bulletList", "h2"],
  bulletList: ["bulletList", "taskList", "paragraph"],
  orderedList: ["orderedList", "taskList", "paragraph"],
  taskList: ["taskList", "bulletList", "paragraph"],
  resources: ["paragraph", "horizontalRule", "blockquote"],
  horizontalRule: ["paragraph", "h1", "bulletList"],
  codeBlock: ["paragraph", "blockquote"],
  table: ["paragraph", "bulletList"],
  callout: ["paragraph", "bulletList"],
};

export const TURN_INTO_MAP: Partial<Record<BlockType, BlockType[]>> = {
  paragraph: ["h1", "h2", "h3", "blockquote", "bulletList", "orderedList", "taskList", "codeBlock"],
  h1: ["h2", "h3", "paragraph", "blockquote", "bulletList", "orderedList", "taskList", "codeBlock"],
  h2: ["h1", "h3", "paragraph", "blockquote", "bulletList", "orderedList", "taskList", "codeBlock"],
  h3: ["h1", "h2", "paragraph", "blockquote", "bulletList", "orderedList", "taskList", "codeBlock"],
  blockquote: ["paragraph", "h1", "h2", "h3", "bulletList", "orderedList", "taskList", "codeBlock"],
  bulletList: ["paragraph", "h1", "h2", "h3", "blockquote", "orderedList", "taskList", "codeBlock"],
  orderedList: ["paragraph", "h1", "h2", "h3", "blockquote", "bulletList", "taskList", "codeBlock"],
  taskList: ["paragraph", "h1", "h2", "h3", "blockquote", "bulletList", "orderedList", "codeBlock"],
  codeBlock: ["paragraph", "h1", "h2", "h3", "blockquote", "bulletList", "orderedList", "taskList"],
};

export function getBlockDef(id: string): BlockDef | undefined {
  return BLOCK_DEFS.find((b) => b.id === id);
}
