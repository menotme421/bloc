"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { ExcalidrawBlock } from "@/components/excalidraw-node";
import { ExcalidrawBoardHost } from "@/components/excalidraw-board";

// TEMPORARY smoke-test route — deleted after verification.
export default function ExcalidrawSmokePage() {
  const editor = useEditor({
    extensions: [StarterKit, ExcalidrawBlock],
    content: `<p>hello</p><div data-excalidraw></div><p>after</p>`,
    immediatelyRender: false,
  });

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <ExcalidrawBoardHost noteTitle="Smoke test" />
      <div className="note-content min-h-[320px]">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
