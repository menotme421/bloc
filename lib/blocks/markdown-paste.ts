"use client";

// Lightweight markdown -> Tiptap JSON parser for paste handling.
// No deps — covers headings, bullet/ordered/task lists, blockquote, code fence, hr, paragraphs.
// Consecutive list items are grouped into single list nodes to avoid duplication.

export type TiptapNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  text?: string;
  marks?: unknown[];
};

function textNode(text: string): TiptapNode {
  return { type: "text", text };
}

function paragraphNode(text: string): TiptapNode {
  if (!text) return { type: "paragraph" };
  return { type: "paragraph", content: [textNode(text)] };
}

function isTableSeparatorLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  // must contain --- and only allow | - : space
  if (!t.includes("---") && !t.includes("--")) return false;
  // allow only | - : and spaces
  const compact = t.replace(/\s/g, "");
  if (!/^[\|\:\-]+$/.test(compact)) return false;
  return true;
}

function isTableRowLine(line: string): boolean {
  const t = line.trim();
  if (!t.includes("|")) return false;
  // at least 2 cells
  const cells = t.split("|").map((c) => c.trim()).filter((c) => c.length > 0);
  return cells.length >= 2;
}

function stripInlineMarkdown(s: string): string {
  // lightweight: remove **, __, *, _, ` but keep text — avoids raw markers in table cells/paragraphs
  return s
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/_(.*?)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1"); // [text](url) -> text
}

export function looksLikeMarkdown(text: string): boolean {
  if (!text || !text.trim()) return false;
  const lines = text.split(/\r?\n/);
  let hits = 0;
  let fence = false;
  for (let idx = 0; idx < lines.length; idx++) {
    const raw = lines[idx];
    const line = raw.trim();
    if (!line) continue;
    if (/^```/.test(line)) { fence = true; hits++; continue; }
    if (fence) continue;
    // table detection: header row + separator
    if (isTableRowLine(line) && idx + 1 < lines.length && isTableSeparatorLine(lines[idx + 1].trim())) {
      hits++;
      continue;
    }
    if (isTableSeparatorLine(line)) continue; // don't double count separator alone
    if (/^#{1,3}\s+\S/.test(line)) hits++;
    else if (/^>\s*\S/.test(line)) hits++;
    else if (/^([-*_])\1\1+$/.test(line.replace(/\s/g, "")) || /^---+$/.test(line) || /^\*\*\*+$/.test(line) || /^___+$/.test(line)) hits++;
    else if (/^[-*•]\s+\[( |x|X)\]\s+\S/.test(line)) hits++;
    else if (/^[-*]\s+\S/.test(line)) hits++;
    else if (/^\d+\.\s+\S/.test(line)) hits++;
  }
  if (fence) return true;
  return hits > 0;
}

export function markdownToTiptapNodes(text: string): TiptapNode[] {
  const lines = text.split(/\r?\n/);
  const nodes: TiptapNode[] = [];
  let i = 0;
  let inCodeFence = false;
  let codeLang: string | null = null;
  let codeLines: string[] = [];

  // helpers to flush pending list groups
  type ListGroup = { type: "bulletList" | "orderedList" | "taskList"; items: TiptapNode[] };
  let pendingList: ListGroup | null = null;

  const flushList = () => {
    if (pendingList && pendingList.items.length) {
      nodes.push({ type: pendingList.type, content: pendingList.items });
    }
    pendingList = null;
  };

  const pushListItem = (kind: "bulletList" | "orderedList" | "taskList", itemText: string, checked?: boolean) => {
    if (!pendingList || pendingList.type !== kind) {
      flushList();
      pendingList = { type: kind, items: [] };
    }
    if (kind === "taskList") {
      pendingList.items.push({
        type: "taskItem",
        attrs: { checked: !!checked },
        content: [paragraphNode(itemText)],
      });
    } else {
      pendingList.items.push({
        type: "listItem",
        content: [paragraphNode(itemText)],
      });
    }
  };

  while (i < lines.length) {
    const raw = lines[i];
    const trimmed = raw.trim();

    // Fenced code block handling
    const fenceMatch = trimmed.match(/^```(\w*)/);
    if (fenceMatch) {
      if (!inCodeFence) {
        // entering fence
        flushList();
        inCodeFence = true;
        codeLang = fenceMatch[1] || null;
        codeLines = [];
        i++;
        continue;
      } else {
        // exiting fence
        inCodeFence = false;
        const codeText = codeLines.join("\n");
        // codeBlock content is single text node with newlines preserved
        nodes.push({
          type: "codeBlock",
          attrs: codeLang ? { language: codeLang } : {},
          content: codeText ? [textNode(codeText)] : [],
        });
        codeLang = null;
        codeLines = [];
        i++;
        continue;
      }
    }
    if (inCodeFence) {
      codeLines.push(raw);
      i++;
      continue;
    }

    if (trimmed === "") {
      // blank line ends current list grouping but not necessarily paragraph
      // flush list so next non-list block is separate; keep paragraph spacing implicit
      flushList();
      i++;
      continue;
    }

    // Markdown table: header | sep | rows
    if (isTableRowLine(trimmed) && i + 1 < lines.length && isTableSeparatorLine(lines[i + 1].trim())) {
      flushList();
      // Proper pipe split: remove leading/trailing empty from "| a | b |"
      let headerRaw = trimmed.split("|");
      if (trimmed.startsWith("|")) headerRaw = headerRaw.slice(1);
      if (trimmed.trim().endsWith("|")) headerRaw = headerRaw.slice(0, -1);
      const headerCells = headerRaw.map((c) => stripInlineMarkdown(c.trim()));
      const colCount = headerCells.length;
      if (colCount >= 2) {
        // consume separator
        i += 2;
        const rows: TiptapNode[] = [];
        // header row
        rows.push({
          type: "tableRow",
          content: headerCells.map((cell) => ({
            type: "tableHeader",
            content: [paragraphNode(cell)],
          })),
        });
        // data rows: consecutive | lines
        while (i < lines.length) {
          const rowRaw = lines[i].trim();
          if (!rowRaw) break;
          if (isTableSeparatorLine(rowRaw)) { i++; continue; }
          if (!rowRaw.includes("|")) break;
          let rawCells = rowRaw.split("|");
          if (rowRaw.startsWith("|")) rawCells = rawCells.slice(1);
          if (rowRaw.trim().endsWith("|")) rawCells = rawCells.slice(0, -1);
          const finalCells = rawCells.map((c) => stripInlineMarkdown(c.trim()));
          // pad/truncate to colCount
          while (finalCells.length < colCount) finalCells.push("");
          const sliced = finalCells.slice(0, colCount);
          rows.push({
            type: "tableRow",
            content: sliced.map((cell) => ({
              type: "tableCell",
              content: [paragraphNode(cell)],
            })),
          });
          i++;
        }
        nodes.push({ type: "table", content: rows });
        continue;
      }
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed.replace(/\s/g, "")) || /^---+$/.test(trimmed) || /^\*\*\*+$/.test(trimmed) || /^___+$/.test(trimmed)) {
      flushList();
      nodes.push({ type: "horizontalRule" });
      i++;
      continue;
    }

    // Heading 1-3
    const headingMatch = trimmed.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      flushList();
      const level = headingMatch[1].length as 1 | 2 | 3;
      const content = stripInlineMarkdown(headingMatch[2].trim());
      nodes.push({
        type: "heading",
        attrs: { level },
        content: content ? [textNode(content)] : [],
      });
      i++;
      continue;
    }

    // Blockquote
    const quoteMatch = trimmed.match(/^>\s?(.*)$/);
    if (quoteMatch) {
      flushList();
      const quoteLines: string[] = [quoteMatch[1]];
      let j = i + 1;
      while (j < lines.length) {
        const nxt = lines[j].trim();
        const m = nxt.match(/^>\s?(.*)$/);
        if (!m) break;
        quoteLines.push(m[1]);
        j++;
      }
      const combined = stripInlineMarkdown(quoteLines.join(" ").trim());
      nodes.push({
        type: "blockquote",
        content: [paragraphNode(combined)],
      });
      i = j;
      continue;
    }

    // Task list item: - [ ] or - [x]
    const taskMatch = raw.match(/^\s*[-*]\s+\[( |x|X)\]\s+(.*)$/);
    if (taskMatch) {
      const checked = taskMatch[1].toLowerCase() === "x";
      const itemText = stripInlineMarkdown(taskMatch[2].trim());
      pushListItem("taskList", itemText, checked);
      i++;
      continue;
    }

    // Bullet list item
    const bulletMatch = raw.match(/^\s*[-*•]\s+(.*)$/);
    if (bulletMatch) {
      const itemText = stripInlineMarkdown(bulletMatch[1].trim());
      pushListItem("bulletList", itemText);
      i++;
      continue;
    }

    // Ordered list item
    const orderedMatch = raw.match(/^\s*\d+\.\s+(.*)$/);
    if (orderedMatch) {
      const itemText = stripInlineMarkdown(orderedMatch[1].trim());
      pushListItem("orderedList", itemText);
      i++;
      continue;
    }

    // Fallback paragraph — strip inline markdown so **bold** doesn't stay raw
    flushList();
    nodes.push(paragraphNode(stripInlineMarkdown(trimmed)));
    i++;
  }

  flushList();

  // If still in fence (unclosed), flush as codeBlock
  if (inCodeFence) {
    const codeText = codeLines.join("\n");
    nodes.push({
      type: "codeBlock",
      attrs: codeLang ? { language: codeLang } : {},
      content: codeText ? [textNode(codeText)] : [],
    });
  }

  if (nodes.length === 0) {
    // fallback single paragraph
    nodes.push(paragraphNode(text.trim()));
  }

  return nodes;
}
