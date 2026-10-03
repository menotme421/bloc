"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { TextStyle } from "@tiptap/extension-text-style";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { CustomCodeBlock } from "@/components/code-block-node-view";
import { lowlight } from "@/lib/code-block-lowlight";
import DragHandle from "@tiptap/extension-drag-handle";
import { offset } from "@floating-ui/dom";
import { TableKit } from "@tiptap/extension-table";
import {
  ColoredTableCell,
  ColoredTableHeader,
} from "@/components/table-cell-color";
import { Placeholder } from "@tiptap/extensions";

import { Button } from "@/components/ui/button";
import { addOutboxEntry, getLocalNote, getOutbox, isInOutbox, markNoteOpened, upsertLocalNote } from "@/lib/local-notes";
import { syncNote, type SyncStatus } from "@/lib/note-sync";
import { setSyncStatus } from "@/lib/note-status";
import type { Note } from "@/lib/notes";
import { useResolvedUserId } from "@/lib/use-resolved-user-id";
import { SlashMenu, type SlashMenuController } from "@/components/slash-menu";
import { TableUI } from "@/components/table-ui";
import { BubbleMenu } from "@/components/bubble-menu";
import { Resource } from "@/components/resource-node";
import { ExcalidrawBlock } from "@/components/excalidraw-node";
import {
  ExcalidrawBoardHost,
  useExcalidrawBoard,
} from "@/components/excalidraw-board";
import { CodeIdeHost, useCodeIDE } from "@/components/code-ide-board";
import { TagChip } from "@/components/tag-chip";
import { uploadResourceFile } from "@/lib/resource-upload";
import { useIsMobile } from "@/hooks/use-mobile";
import { MiniToolbar } from "@/components/mobile/mini-toolbar";
import { BlockPickerSheet } from "@/components/mobile/block-picker-sheet";
import { BlockActionMenu } from "@/components/mobile/block-action-menu";
import { MobileSlashInterceptor } from "@/lib/extensions/mobile-slash-interceptor";
import { looksLikeMarkdown, markdownToTiptapNodes } from "@/lib/blocks/markdown-paste";

const SAVE_DEBOUNCE_MS = 800;
const SYNC_MAX_ROUNDS = 3;

export function NoteEditor({
  userId: userIdProp,
  note,
}: {
  userId: string;
  note?: Note | null;
}) {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const userId = useResolvedUserId(userIdProp);
  const userIdRef = React.useRef(userId);
  React.useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);
  const editorReadyRef = React.useRef(false);

  const [title, setTitle] = React.useState(note?.title ?? "");
  const [tag, setTag] = React.useState<string | null>(note?.tag ?? null);
  const [tagInput, setTagInput] = React.useState("");
  const [resolved, setResolved] = React.useState<"loading" | "ready" | "missing">(
    note ? "ready" : "loading"
  );

  const syncingRef = React.useRef(false);
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  const titleRef = React.useRef<HTMLInputElement | null>(null);
  const tagInputRef = React.useRef<HTMLInputElement | null>(null);
  const slashControllerRef = React.useRef<SlashMenuController | null>(null);
  const tableAnchorRef = React.useRef<{ pos: number } | null>(null);
  const editorRef = React.useRef<Editor | null>(null);
  const dragHandleElRef = React.useRef<HTMLElement | null>(null);

  const isMobile = useIsMobile();
  const board = useExcalidrawBoard();
  const boardOpen = board !== null;
  const ide = useCodeIDE();
  const ideOpen = ide !== null;
  const takeoverOpen = boardOpen || ideOpen;
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [slashRange, setSlashRange] = React.useState<{ from: number; to: number } | null>(null);
  const handleOpenPicker = React.useCallback((from: number, to: number) => {
    setSlashRange({ from, to });
    setPickerOpen(true);
  }, []);
  const handleToolbarAddBlock = React.useCallback(() => {
    if (!editorRef.current) return;
    const from = editorRef.current.state.selection.from;
    const to = editorRef.current.state.selection.to;
    setSlashRange({ from, to });
    setPickerOpen(true);
  }, []);

  const editor = useEditor(
    {
      autofocus: false,
      extensions: [
        StarterKit.configure({
          codeBlock: false,
          link: { openOnClick: true },
        }),
        TextStyle,
        Color,
        Highlight.configure({ multicolor: true }),
        Subscript,
        Superscript,
        TaskList,
        TaskItem,
        CustomCodeBlock.configure({
          lowlight,
          enableTabIndentation: true,
          defaultLanguage: "plaintext",
        }),
        TableKit.configure({
          table: { resizable: true },
          tableCell: false,
          tableHeader: false,
        }),
        ColoredTableCell,
        ColoredTableHeader,
        Resource.configure({ userId }),
        ExcalidrawBlock,
        DragHandle.configure({
          computePositionConfig: {
            placement: "left-start",
            strategy: "absolute",
            middleware: [offset({ mainAxis: 8 })],
          },
          render: () => {
            const element = document.createElement("div");
            element.className = "drag-handle";
            element.innerHTML =
              '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/></svg>';
            dragHandleElRef.current = element;
            return element;
          },
          nested: {
            // 'none' disables edge-proximity deduction so each listItem/taskItem
            // wins over the list wrapper both centered and in the gutter —
            // every bullet/number row gets its own handle like paragraphs.
            // Whole-list move stays available via block menu / turn-into
            // (findDocBlock), which intentionally remain whole-list.
            edgeDetection: "none",
            rules: [
              {
                id: "excludeTableCellContent",
                evaluate: ({ parent }) =>
                  parent &&
                  (parent.type.name === "tableCell" ||
                    parent.type.name === "tableHeader")
                    ? 1000
                    : 0,
              },
            ],
          },
          onNodeChange: ({ node }) => {
            // Tag the handle with its target type so CSS can shift listItem
            // handles left into the paragraph lane (taskItem needs no shift:
            // taskList has padding-left 0 and is already aligned).
            const el = dragHandleElRef.current;
            if (!el) return;
            el.dataset.target = node ? node.type.name : "";
          },
        }),
        Placeholder.configure({
          placeholder: ({ editor, pos }) =>
            editor.state.doc.resolve(pos).parent.type.name === "tableCell" ||
            editor.state.doc.resolve(pos).parent.type.name === "tableHeader"
              ? ""
              : "Type / for commands…",
          emptyNodeClass: "is-empty",
        }),
        MobileSlashInterceptor.configure({ onOpenPicker: handleOpenPicker }),
      ],
      content: note?.content ?? "",
      immediatelyRender: false,
      shouldRerenderOnTransaction: false,
      editorProps: {
        attributes: {
          class: "note-content min-h-[320px] focus:outline-none",
        },
        // Keep ~120px of breathing room around the caret on every
        // transaction — without this ProseMirror only scrolls the cursor
        // barely into view, so typing pins it at the viewport bottom edge.
        // Paired with trailing padding in globals.css (there must be space
        // below the last line to scroll into).
        scrollMargin: 120,
        handleKeyDown: (_view, event) => {
          if (slashControllerRef.current?.onKeyDown(event)) return true;
          if (
            event.key === "ArrowUp" &&
            !event.shiftKey &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.altKey &&
            _view.state.selection.from <= 1
          ) {
            event.preventDefault();
            tagInputRef.current?.focus();
            return true;
          }
          return false;
        },
        handlePaste: (_view, event) => {
          // 1) Image file paste — keep existing behavior (single file at current pos)
          const items = Array.from(event.clipboardData?.items ?? []);
          const files = items
            .filter(
              (item) => item.kind === "file" && item.type.startsWith("image/")
            )
            .map((item) => item.getAsFile())
            .filter((file): file is File => file !== null);
          if (files.length > 0) {
            event.preventDefault();
            const file = files[0];
            const insertPos = _view.state.selection.from;
            const insertPlaceholder = () => {
              editorRef.current
                ?.chain()
                .focus()
                .insertContentAt(insertPos, {
                  type: "paragraph",
                  content: [
                    {
                      type: "text",
                      text: `📷 ${file.name} (image pending upload — reconnect to add)`,
                    },
                  ],
                })
                .run();
            };
            if (typeof navigator !== "undefined" && !navigator.onLine) {
              insertPlaceholder();
              return true;
            }
            void uploadResourceFile(file, userIdRef.current)
              .then((url) => {
                editorRef.current
                  ?.chain()
                  .focus()
                  .insertContentAt(insertPos, {
                    type: "resource",
                    attrs: {
                      src: url,
                      name: file.name,
                      type: file.type || "application/octet-stream",
                      size: file.size,
                    },
                  })
                  .run();
              })
              .catch((e) => {
                console.error("[paste] upload failed", e);
                insertPlaceholder();
              });
            return true;
          }

          // 2) Markdown plain-text paste -> render as blocks (no duplication)
          try {
            const html = event.clipboardData?.getData("text/html") ?? "";
            const text = event.clipboardData?.getData("text/plain") ?? "";
            if (!text || !text.trim()) return false;

            // If clipboard provides rich HTML with real block tags, let ProseMirror handle it
            // (e.g. copy from Notion/web retains <h1><ul>). Only intercept text/plain markdown.
            if (html && /<(h[1-3]|ul|ol|blockquote|pre|li|table)[\s>]/i.test(html)) {
              return false;
            }

            if (!looksLikeMarkdown(text)) return false;

            const nodes = markdownToTiptapNodes(text);
            if (!nodes.length) return false;

            event.preventDefault();
            // Use deleteSelection to replace any selected range, single insert — prevents duplication
            // (must return true to suppress default paste which would insert raw "# ..." paragraphs)
            const ok = editorRef.current?.chain().focus().deleteSelection().insertContent(nodes).run();
            // Fallback to view insertion if chain failed (e.g. editor not ready)
            if (!ok && editorRef.current) {
              try {
                const { from, to } = _view.state.selection;
                const tr = _view.state.tr.delete(from, to);
                _view.dispatch(tr);
                editorRef.current.chain().focus().insertContent(nodes).run();
              } catch {}
            }
            return true;
          } catch {
            return false;
          }
        },
      },
      onCreate: ({ editor: created }) => {
        editorRef.current = created;
        editorReadyRef.current = true;
        if (userId) {
          handleResolve(created);
        }
      },
    },
    [note?.id]
  );

  function handleResolve(editorInstance: Editor) {
    if (!id) return;
    const currentUserId = userIdRef.current;
    if (!currentUserId) return;

    // Offline shell fallback may serve another note's cached RSC for a brand-new
    // id — ignore a server prop that doesn't match the URL id so the local
    // offline note wins instead of rendering the wrong note.
    const server = note && note.id === id ? note : null;
    const local = getLocalNote(currentUserId, id);

    if (!local && !server) {
      setResolved("missing");
      return;
    }

    if (local && !server) {
      setTitle(local.title);
      setTag(local.tag ?? null);
      editorInstance.commands.setContent(local.content, { emitUpdate: false });
      editorInstance.commands.fixTables();
      markNoteOpened(currentUserId, id);
      setResolved("ready");
      if (!isInOutbox(currentUserId, id)) {
        addOutboxEntry(currentUserId, { note: local, mode: "create" });
      }
      void syncLoop("create");
      return;
    }

    markNoteOpened(currentUserId, id);

    if (local && server) {
      const localTime = Date.parse(local.updated_at);
      const serverTime = Date.parse(server.updated_at);
      const dirty = isInOutbox(currentUserId, id) || localTime > serverTime;
      if (dirty) {
        setTitle(local.title);
        setTag(local.tag ?? null);
        editorInstance.commands.setContent(local.content, {
          emitUpdate: false,
        });
        editorInstance.commands.fixTables();
        if (!isInOutbox(currentUserId, id)) {
          addOutboxEntry(currentUserId, { note: local, mode: "update" });
        }
        setResolved("ready");
        void syncLoop("update");
        return;
      }
      if (localTime < serverTime) {
        upsertLocalNote(currentUserId, server);
      }
      setResolved("ready");
      return;
    }

    if (!local && server) {
      upsertLocalNote(currentUserId, server);
      setTag(server.tag ?? null);
      editorInstance.commands.fixTables();
      setResolved("ready");
    }
  }

  React.useEffect(() => {
    if (userId && editorReadyRef.current && editor && id) {
      handleResolve(editor);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, editor, id]);

  // Reconnect: drain outbox when browser goes back online.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const onOnline = () => {
      const uid = userIdRef.current;
      if (!uid || !id) return;
      const pending = getOutbox(uid).find((e) => e.note.id === id);
      if (pending) void syncLoop(pending.mode);
      else if (!navigator.onLine) return;
      else {
        // Even without pending entry, try a save-round to set badge right.
        setSyncStatus(isInOutbox(uid, id) ? "offline" : "synced");
      }
    };
    const onOffline = () => setSyncStatus("offline");
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function handleTitleChange(value: string) {
    setTitle(value);
    const currentUserId = userIdRef.current;
    if (!id || !currentUserId) return;
    const existing = getLocalNote(currentUserId, id);
    if (!existing) return;
    const updated: Note = {
      ...existing,
      title: value,
      updated_at: new Date().toISOString(),
    };
    upsertLocalNote(currentUserId, updated);
    addOutboxEntry(currentUserId, { note: updated, mode: "update" });
    scheduleSave();
  }

  function handleTagCommit(raw: string) {
    const value = raw.trim().slice(0, 50);
    if (!value) return;
    if (tag === value) {
      setTagInput("");
      return;
    }
    handleTagChange(value);
  }

  function handleTagChange(value: string | null) {
    setTag(value);
    setTagInput("");
    const currentUserId = userIdRef.current;
    if (!id || !currentUserId) return;
    const existing = getLocalNote(currentUserId, id);
    if (!existing) return;
    const updated: Note = {
      ...existing,
      tag: value,
      updated_at: new Date().toISOString(),
    };
    upsertLocalNote(currentUserId, updated);
    addOutboxEntry(currentUserId, { note: updated, mode: "update" });
    scheduleSave();
  }

  function focusEditor() {
    const editorInstance = editorRef.current;
    if (editorInstance && !editorInstance.view.hasFocus()) {
      editorInstance.view.focus();
    }
  }

  const isComposingRef = React.useRef(false);
  function handleTagInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (isComposingRef.current || (e.nativeEvent as unknown as { isComposing?: boolean })?.isComposing) return;
    if (e.key === "Enter") {
      e.preventDefault();
      if (tagInput.trim()) handleTagCommit(tagInput);
      else focusEditor();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (tagInput.trim()) handleTagCommit(tagInput);
      focusEditor();
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      titleRef.current?.focus();
      return;
    }
    if ((e.key === "Backspace" || e.key === "Delete") && tagInput === "") {
      e.preventDefault();
      handleTagChange(null);
    }
  }

  async function syncLoop(mode: "create" | "update") {
    if (syncingRef.current || !id) return;
    const currentUserId = userIdRef.current;
    if (!currentUserId) return;
    syncingRef.current = true;
    try {
      setSyncStatus("saving");
      let status: SyncStatus = "offline";
      for (let round = 0; round < SYNC_MAX_ROUNDS; round++) {
        const current = getLocalNote(currentUserId, id);
        if (!current) {
          status = "synced";
          break;
        }
        status = await syncNote(currentUserId, current, mode);
        mode = "update";
        if (status === "synced" && !isInOutbox(currentUserId, id)) break;
        if (status === "offline") break;
      }
      setSyncStatus(status);
    } finally {
      syncingRef.current = false;
    }
  }

  function scheduleSave() {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = setTimeout(() => {
      void doSave();
    }, SAVE_DEBOUNCE_MS);
  }

  function doSave() {
    if (!id || !editor) return;
    const currentUserId = userIdRef.current;
    if (!currentUserId) return;

    const existing = getLocalNote(currentUserId, id);
    const outboxEntry = getOutbox(currentUserId).find((e) => e.note.id === id);
    const mode = outboxEntry?.mode ?? "update";
    const note: Note = {
      id,
      title: existing?.title.trim() || title.trim(),
      content: editor.getHTML(),
      tag: existing?.tag ?? null,
      created_at: existing?.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    upsertLocalNote(currentUserId, note);
    addOutboxEntry(currentUserId, { note, mode });
    void syncLoop(mode);
  }

  React.useEffect(() => {
    if (!editor) return;
    if (!id) return;

    const onUpdate = () => {
      // Debounced save only — avoid per-keystroke getHTML + localStorage sync which blocks main thread
      scheduleSave();
    };

    editor.on("update", onUpdate);
    return () => {
      editor.off("update", onUpdate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, userId, id, title]);

  if (resolved === "missing") {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 py-10">
        <div className="flex flex-col items-center gap-2 rounded-lg border bg-card py-16 text-center">
          <p className="text-base font-semibold">Note not found</p>
          <p className="max-w-sm text-lg text-muted-foreground">
            This note does not exist or was deleted.
          </p>
          <Button asChild size="sm" className="mt-2">
            <Link href="/app/notes">Back to notes</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={
        takeoverOpen
          ? "flex w-full max-w-none flex-1 flex-col"
          : "mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-10 sm:px-6"
      }
    >
      {/* Takeover owns the whole note screen below the app top bar
          (which already shows the note title + sync status). Nothing else
          shares the screen so the canvas / IDE gets maximum space.
          IDE wins over board if both somehow open. */}
      {ideOpen ? (
        <CodeIdeHost noteTitle={title} />
      ) : boardOpen ? (
        <ExcalidrawBoardHost noteTitle={title} />
      ) : null}
      <div className={takeoverOpen ? "hidden" : "flex flex-col gap-5"}>
        <input
          ref={titleRef}
          value={title}
          data-tour="note-title"
          onChange={(e) => handleTitleChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "Enter") {
              e.preventDefault();
              tagInputRef.current?.focus();
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              focusEditor();
            }
          }}
          placeholder="Untitled"
          className="w-full bg-transparent text-3xl font-bold tracking-tight text-foreground outline-none placeholder:text-muted-foreground sm:text-4xl"
        />
        <div className="flex flex-wrap items-center gap-2" data-tour="note-tag">
          {tag && (
            <TagChip
              tag={tag}
              onRemove={() => handleTagChange(null)}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Backspace" || e.key === "Delete") {
                  e.preventDefault();
                  handleTagChange(null);
                } else if (e.key === "ArrowDown") {
                  e.preventDefault();
                  focusEditor();
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  titleRef.current?.focus();
                }
              }}
            />
          )}
          <input
            ref={tagInputRef}
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onCompositionStart={() => { isComposingRef.current = true; }}
            onCompositionEnd={() => { isComposingRef.current = false; }}
            onKeyDown={handleTagInputKeyDown}
            enterKeyHint="done"
            inputMode="text"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder={tag ? "Replace tag…" : "Add tag…"}
            aria-label={tag ? "Replace tag" : "Add tag"}
            className="h-6 w-28 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
        {/* The editor stays mounted while a takeover is open (hidden, NOT
            unmounted): unmounting EditorContent destroys all TipTap NodeViews,
            which would silently break saving the board / IDE back into its block. */}
        <div
          ref={contentRef}
          data-tour="slash-blocks"
          className={takeoverOpen ? "hidden" : "relative"}
        >
          {/* Desktop slash menu — untouched, never mounted on mobile */}
          {!isMobile && <SlashMenu editor={editor} controllerRef={slashControllerRef} />}
          {!isMobile && <BubbleMenu editor={editor} userId={userId} />}
          <TableUI
            editor={editor}
            containerRef={contentRef}
            tableAnchorRef={tableAnchorRef}
          />
          <EditorContent editor={editor} />
          {/* Mobile block action menu — long-press handler attached to contentRef */}
          <BlockActionMenu editor={editor} isMobile={isMobile} contentRef={contentRef} />
        </div>
      </div>
      {/* Mobile-only 3-part system — no leak to desktop, hidden while takeover open */}
      {isMobile && !takeoverOpen && (
        <>
          <MiniToolbar editor={editor} isMobile={isMobile} onAddBlock={handleToolbarAddBlock} userId={userId} />
          <BlockPickerSheet
            editor={editor}
            open={pickerOpen}
            onOpenChange={(o) => {
              setPickerOpen(o);
              if (!o) {
                setSlashRange(null);
                // When picker closed without selection, keyboard reappears and focus returns
                setTimeout(() => editor?.chain().focus().run(), 80);
              }
            }}
            slashRange={slashRange}
          />
        </>
      )}
    </div>
  );
}