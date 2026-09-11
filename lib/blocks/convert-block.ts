"use client";

import type { Editor } from "@tiptap/react";
import type { BlockType } from "./block-config";

// Find the top-level doc block containing pos (same logic as block-action-menu)
function findDocBlock($pos: ReturnType<Editor["state"]["doc"]["resolve"]>) {
  for (let d = 1; d <= $pos.depth; d++) {
    const node = $pos.node(d);
    const parent = d > 0 ? $pos.node(d - 1) : null;
    if (node.isBlock && parent && parent.type.name === "doc") {
      return { node, pos: $pos.before(d), depth: d, $pos };
    }
  }
  try {
    const doc = $pos.doc as unknown as { childCount: number; child: (i: number) => { nodeSize: number; isBlock: boolean }; content: { size: number } };
    const idx = Math.min($pos.index(0), doc.childCount - 1);
    if (idx >= 0 && idx < doc.childCount) {
      let curPos = 0;
      for (let i = 0; i < idx; i++) curPos += doc.child(i).nodeSize;
      const node = doc.child(idx);
      if (node.isBlock) return { node: node as unknown as ReturnType<typeof $pos.node>, pos: curPos, depth: 1, $pos };
      if (idx + 1 < doc.childCount) {
        const n2 = doc.child(idx + 1);
        if (n2.isBlock) {
          const p2 = curPos + node.nodeSize;
          return { node: n2 as unknown as ReturnType<typeof $pos.node>, pos: p2, depth: 1, $pos };
        }
      }
    }
  } catch {}
  let depth = $pos.depth;
  while (depth > 0) {
    const node = $pos.node(depth);
    if (node.isBlock) return { node, pos: $pos.before(depth), depth, $pos };
    depth--;
  }
  return null;
}

function findInlinePos(editor: Editor, anchorPos: number): number {
  try {
    const $pos = editor.state.doc.resolve(anchorPos);
    if ($pos.parent.inlineContent) return anchorPos;
    const found = findDocBlock($pos);
    if (!found) return anchorPos;
    const { pos: blockPos, node } = found;
    // scan inside block for first inline parent
    for (let p = blockPos + 1; p < blockPos + node.nodeSize && p < editor.state.doc.content.size; p++) {
      try {
        const $p = editor.state.doc.resolve(p);
        if ($p.parent.inlineContent) return p;
      } catch {}
    }
    // fallback: blockPos+1 clamped
    return Math.min(blockPos + 1, Math.max(0, editor.state.doc.content.size - 1));
  } catch {
    return anchorPos;
  }
}

/**
 * Convert the block at the current selection to target type.
 * Single transaction: focus -> (setSelection if needed) -> clearNodes -> target.
 * This correctly handles list<->list, list->text, quote->list, etc. by
 * lifting the wrapper first then re-wrapping.
 */
export function convertBlock(editor: Editor, target: BlockType): boolean {
  if (!editor) return false;
  try {
    const { from, to, empty } = editor.state.selection;
    // For ranged selections, keep the range; for collapsed, ensure inline pos
    let needInlineFix = false;
    let inlinePos = from;
    try {
      const $from = editor.state.doc.resolve(from);
      if (!$from.parent.inlineContent) {
        inlinePos = findInlinePos(editor, from);
        needInlineFix = inlinePos !== from;
      } else if (!empty) {
        // ranged selection: check if both ends are inline; if not, fallback to collapsed
        try {
          const $to = editor.state.doc.resolve(to);
          if (!$to.parent.inlineContent) needInlineFix = true;
        } catch { needInlineFix = true; }
      }
    } catch { needInlineFix = false; }

    const runChain = (withInlineFix: boolean): boolean => {
      let chain: ReturnType<Editor["chain"]> = editor.chain().focus();
      if (withInlineFix && needInlineFix) {
        const size = editor.state.doc.content.size;
        const clamped = Math.max(0, Math.min(inlinePos, size - 1));
        try {
          editor.state.doc.resolve(clamped);
          chain = chain.setTextSelection(clamped);
        } catch {}
      }
      chain = chain.clearNodes();
      switch (target) {
        case "paragraph": chain = chain.setParagraph(); break;
        case "h1": chain = chain.setHeading({ level: 1 }); break;
        case "h2": chain = chain.setHeading({ level: 2 }); break;
        case "h3": chain = chain.setHeading({ level: 3 }); break;
        case "blockquote": chain = chain.toggleBlockquote(); break;
        case "bulletList": chain = chain.toggleBulletList(); break;
        case "orderedList": chain = chain.toggleOrderedList(); break;
        case "taskList": chain = chain.toggleTaskList(); break;
        case "codeBlock": chain = chain.setCodeBlock(); break;
        case "horizontalRule": chain = chain.setHorizontalRule(); break;
        default: return false;
      }
      return chain.run();
    };

    let ok = runChain(true);
    console.log("[convertBlock] first attempt", { target, from, to, empty, needInlineFix, inlinePos, ok });
    if (!ok) {
      // Fallback: try without inline fix (keep original selection range)
      ok = runChain(false);
      console.log("[convertBlock] fallback without inlineFix", { ok });
    }
    if (!ok) {
      // Second fallback: two separate transactions (unwrap then wrap)
      try {
        const first = editor.chain().focus().clearNodes().run();
        console.log("[convertBlock] fallback clearNodes alone", first);
        let secondChain: ReturnType<Editor["chain"]> = editor.chain().focus();
        if (needInlineFix) {
          try { secondChain = secondChain.setTextSelection(inlinePos); } catch {}
        }
        switch (target) {
          case "paragraph": secondChain = secondChain.setParagraph(); break;
          case "h1": secondChain = secondChain.setHeading({ level: 1 }); break;
          case "h2": secondChain = secondChain.setHeading({ level: 2 }); break;
          case "h3": secondChain = secondChain.setHeading({ level: 3 }); break;
          case "blockquote": secondChain = secondChain.toggleBlockquote(); break;
          case "bulletList": secondChain = secondChain.toggleBulletList(); break;
          case "orderedList": secondChain = secondChain.toggleOrderedList(); break;
          case "taskList": secondChain = secondChain.toggleTaskList(); break;
          case "codeBlock": secondChain = secondChain.setCodeBlock(); break;
          case "horizontalRule": secondChain = secondChain.setHorizontalRule(); break;
        }
        ok = secondChain.run();
        console.log("[convertBlock] fallback second chain", ok);
      } catch (e) {
        console.warn("[convertBlock] fallback error", e);
      }
    }
    try { editor.chain().focus().scrollIntoView().run(); } catch {}
    return ok;
  } catch (e) {
    console.warn("[convertBlock] error", e);
    return false;
  }
}

/**
 * Convert the block at a specific doc position (e.g. mobile BlockActionMenu's selectedRef.pos)
 * to the target type. More robust than convertBlock when selection has moved to a portal.
 */
export function convertBlockAtPos(editor: Editor, blockPos: number, target: BlockType): boolean {
  if (!editor) return false;
  try {
    const docSize = editor.state.doc.content.size;
    // clamp blockPos into valid range
    let pos = Math.max(0, Math.min(blockPos, Math.max(0, docSize - 1)));
    try {
      editor.state.doc.resolve(pos);
    } catch {
      // fallback to current selection
      pos = editor.state.selection.from;
    }
    const inlinePos = findInlinePos(editor, pos);
    const size = editor.state.doc.content.size;
    const clampedInline = Math.max(0, Math.min(inlinePos, Math.max(0, size - 1)));
    try { editor.state.doc.resolve(clampedInline); } catch { return false; }

    let chain: ReturnType<Editor["chain"]> = editor.chain().focus().setTextSelection(clampedInline).clearNodes();
    switch (target) {
      case "paragraph": chain = chain.setParagraph(); break;
      case "h1": chain = chain.setHeading({ level: 1 }); break;
      case "h2": chain = chain.setHeading({ level: 2 }); break;
      case "h3": chain = chain.setHeading({ level: 3 }); break;
      case "blockquote": chain = chain.toggleBlockquote(); break;
      case "bulletList": chain = chain.toggleBulletList(); break;
      case "orderedList": chain = chain.toggleOrderedList(); break;
      case "taskList": chain = chain.toggleTaskList(); break;
      case "codeBlock": chain = chain.setCodeBlock(); break;
      case "horizontalRule": chain = chain.setHorizontalRule(); break;
      default: return false;
    }
    const ok = chain.run();
    try { editor.chain().focus().scrollIntoView().run(); } catch {}
    return ok;
  } catch {
    return false;
  }
}
