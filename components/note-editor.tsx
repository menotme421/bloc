"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import DragHandle from "@tiptap/extension-drag-handle";
import { TableKit } from "@tiptap/extension-table";
import {
  ColoredTableCell,
  ColoredTableHeader,
} from "@/components/table-cell-color";
import { Placeholder } from "@tiptap/extensions";
import { createLowlight } from "lowlight";
import bash from "highlight.js/lib/languages/bash";
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import css from "highlight.js/lib/languages/css";
import diff from "highlight.js/lib/languages/diff";
import go from "highlight.js/lib/languages/go";
import http from "highlight.js/lib/languages/http";
import ini from "highlight.js/lib/languages/ini";
import java from "highlight.js/lib/languages/java";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import makefile from "highlight.js/lib/languages/makefile";
import markdown from "highlight.js/lib/languages/markdown";
import php from "highlight.js/lib/languages/php";
import plaintext from "highlight.js/lib/languages/plaintext";
import python from "highlight.js/lib/languages/python";
import rust from "highlight.js/lib/languages/rust";
import shell from "highlight.js/lib/languages/shell";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";

const lowlight = createLowlight();
const lowlightGrammars: Record<string, typeof javascript> = {
  js: javascript,
  jsx: javascript,
  javascript,
  ts: typescript,
  tsx: typescript,
  typescript,
  css,
  html: xml,
  svg: xml,
  xml,
  json,
  py: python,
  python,
  bash,
  sh: shell,
  shell,
  sql,
  md: markdown,
  markdown,
  java,
  c,
  cpp,
  "c++": cpp,
  go,
  rs: rust,
  rust,
  php,
  yml: yaml,
  yaml,
  diff,
  ini,
  http,
  makefile,
  text: plaintext,
  plaintext,
};
lowlight.register(lowlightGrammars);

import { Button } from "@/components/ui/button";
import { addOutboxEntry, getLocalNote, getOutbox, isInOutbox, setLastNoteId, upsertLocalNote } from "@/lib/local-notes";
import { syncNote, type SyncStatus } from "@/lib/note-sync";
import { setSyncStatus } from "@/lib/note-status";
import type { Note } from "@/lib/notes";
import { SlashMenu, type SlashMenuController } from "@/components/slash-menu";
import { TableUI } from "@/components/table-ui";

const SAVE_DEBOUNCE_MS = 800;
const SYNC_MAX_ROUNDS = 3;

export function NoteEditor({
  userId,
  note,
}: {
  userId: string;
  note?: Note | null;
}) {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [title, setTitle] = React.useState(note?.title ?? "");
  const [resolved, setResolved] = React.useState<"loading" | "ready" | "missing">(
    note ? "ready" : "loading"
  );

  const syncingRef = React.useRef(false);
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  const slashControllerRef = React.useRef<SlashMenuController | null>(null);
  const tableAnchorRef = React.useRef<{ pos: number } | null>(null);

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({ codeBlock: false }),
        TaskList,
        TaskItem,
        CodeBlockLowlight.configure({
          lowlight,
          enableTabIndentation: true,
        }),
        TableKit.configure({
          table: { resizable: true },
          tableCell: false,
          tableHeader: false,
        }),
        ColoredTableCell,
        ColoredTableHeader,
        DragHandle.configure({
          render: () => {
            const element = document.createElement("div");
            element.className = "drag-handle";
            element.innerHTML =
              '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/></svg>';
            return element;
          },
          nested: {
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
          onNodeChange: () => {},
        }),
        Placeholder.configure({
          placeholder: ({ editor, pos }) =>
            editor.state.doc.resolve(pos).parent.type.name === "tableCell" ||
            editor.state.doc.resolve(pos).parent.type.name === "tableHeader"
              ? ""
              : "Type / for commands…",
          emptyNodeClass: "is-empty",
        }),
      ],
      content: note?.content ?? "",
      immediatelyRender: false,
      shouldRerenderOnTransaction: true,
      editorProps: {
        attributes: {
          class: "note-content min-h-[320px] focus:outline-none",
        },
        handleKeyDown: (_view, event) =>
          slashControllerRef.current?.onKeyDown(event) ?? false,
      },
      onCreate: ({ editor: created }) => {
        handleResolve(created);
      },
    },
    [note?.id]
  );

  function handleResolve(editorInstance: Editor) {
    if (!id) return;

    const server = note ?? null;
    const local = getLocalNote(userId, id);

    if (!local && !server) {
      setResolved("missing");
      return;
    }

    if (local && !server) {
      setTitle(local.title);
      editorInstance.commands.setContent(local.content, { emitUpdate: false });
      editorInstance.commands.fixTables();
      setLastNoteId(userId, id);
      setResolved("ready");
      if (!isInOutbox(userId, id)) {
        addOutboxEntry(userId, { note: local, mode: "create" });
      }
      void syncLoop("create");
      return;
    }

    setLastNoteId(userId, id);

    if (local && server) {
      const localTime = Date.parse(local.updated_at);
      const serverTime = Date.parse(server.updated_at);
      const dirty = isInOutbox(userId, id) || localTime > serverTime;
      if (dirty) {
        setTitle(local.title);
        editorInstance.commands.setContent(local.content, {
          emitUpdate: false,
        });
        editorInstance.commands.fixTables();
        if (!isInOutbox(userId, id)) {
          addOutboxEntry(userId, { note: local, mode: "update" });
        }
        setResolved("ready");
        void syncLoop("update");
        return;
      }
      if (localTime < serverTime) {
        upsertLocalNote(userId, server);
      }
      setResolved("ready");
      return;
    }

    if (!local && server) {
      upsertLocalNote(userId, server);
      editorInstance.commands.fixTables();
      setResolved("ready");
    }
  }

  function handleTitleChange(value: string) {
    setTitle(value);
    if (!id) return;
    const existing = getLocalNote(userId, id);
    if (!existing) return;
    const updated: Note = {
      ...existing,
      title: value,
      updated_at: new Date().toISOString(),
    };
    upsertLocalNote(userId, updated);
    addOutboxEntry(userId, { note: updated, mode: "update" });
    setLastNoteId(userId, id);
    scheduleSave();
  }

  async function syncLoop(mode: "create" | "update") {
    if (syncingRef.current || !id) return;
    syncingRef.current = true;
    try {
      setSyncStatus("saving");
      let status: SyncStatus = "offline";
      for (let round = 0; round < SYNC_MAX_ROUNDS; round++) {
        const current = getLocalNote(userId, id);
        if (!current) {
          status = "synced";
          break;
        }
        status = await syncNote(userId, current, mode);
        mode = "update";
        if (status === "synced" && !isInOutbox(userId, id)) break;
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

    const existing = getLocalNote(userId, id);
    const outboxEntry = getOutbox(userId).find((e) => e.note.id === id);
    const mode = outboxEntry?.mode ?? "update";
    const note: Note = {
      id,
      title: existing?.title.trim() || title.trim(),
      content: editor.getHTML(),
      created_at: existing?.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    upsertLocalNote(userId, note);
    addOutboxEntry(userId, { note, mode });
    setLastNoteId(userId, id);
    void syncLoop(mode);
  }

  React.useEffect(() => {
    if (!editor) return;
    if (!id) return;

    const onUpdate = () => {
      const content = editor.getHTML();
      const existing = getLocalNote(userId, id);
      const updated: Note = {
        id,
        title: existing?.title ?? title,
        content,
        created_at: existing?.created_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      upsertLocalNote(userId, updated);
      setLastNoteId(userId, id);
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
        <div className="card card-bordered flex flex-col items-center gap-2 py-16 text-center">
          <p className="text-body-semibold">Note not found</p>
          <p className="max-w-sm text-body text-foreground-muted">
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
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-10 sm:px-6">
      <div className="flex flex-col gap-5">
        <input
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Untitled"
          className="w-full bg-transparent text-3xl font-bold tracking-tight text-foreground outline-none placeholder:text-foreground-muted sm:text-4xl"
        />
        <div ref={contentRef} className="relative">
          <SlashMenu editor={editor} controllerRef={slashControllerRef} />
          <TableUI
            editor={editor}
            containerRef={contentRef}
            tableAnchorRef={tableAnchorRef}
          />
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}