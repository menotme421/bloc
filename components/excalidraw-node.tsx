"use client";

import * as React from "react";
import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { ExpandIcon, PenToolIcon, Trash2Icon } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { ExcalidrawLazy } from "./excalidraw-lazy";
import {
  openExcalidrawBoard,
  useExcalidrawBoard,
} from "./excalidraw-board";
import type { ExcalidrawScene } from "./excalidraw-canvas";

export const EXCALIDRAW_MAX_SCENE_CHARS = 900_000;

export function parseExcalidrawScene(raw: unknown): ExcalidrawScene | null {
  if (!raw || typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw) as ExcalidrawScene;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      elements: Array.isArray(parsed.elements) ? parsed.elements : [],
      appState:
        parsed.appState && typeof parsed.appState === "object"
          ? parsed.appState
          : undefined,
      files:
        parsed.files && typeof parsed.files === "object"
          ? parsed.files
          : undefined,
    };
  } catch {
    return null;
  }
}

export function serializeExcalidrawScene(scene: ExcalidrawScene): string {
  try {
    return JSON.stringify({
      elements: scene.elements ?? [],
      appState: scene.appState
        ? { viewBackgroundColor: scene.appState.viewBackgroundColor }
        : undefined,
      files: scene.files ?? undefined,
    });
  } catch {
    return JSON.stringify({ elements: [] });
  }
}

function hashScene(raw: string | null): string {
  if (!raw) return "empty";
  // djb2 — cheap remount key so the read-only preview picks up board saves.
  let h = 5381;
  for (let i = 0; i < raw.length; i++) {
    h = ((h << 5) + h + raw.charCodeAt(i)) | 0;
  }
  return `${raw.length}:${h}`;
}

function countElements(scene: ExcalidrawScene | null): number {
  if (!scene?.elements) return 0;
  try {
    return scene.elements.filter((e) => !e.isDeleted).length;
  } catch {
    return 0;
  }
}

function resolveTheme(theme: "light" | "dark" | "system"): "light" | "dark" {
  if (typeof document === "undefined") return theme === "dark" ? "dark" : "light";
  if (theme === "dark") return "dark";
  if (theme === "light") return "light";
  // system: follow the app's resolved theme (document class) first,
  // fall back to OS preference.
  if (document.documentElement.classList.contains("dark")) return "dark";
  if (document.documentElement.classList.contains("light")) return "light";
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  } catch {
    return "light";
  }
}

export const ExcalidrawBlock = Node.create({
  name: "excalidraw",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      data: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-scene"),
        renderHTML: (attributes) =>
          attributes.data ? { "data-scene": attributes.data } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-excalidraw]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-excalidraw": "",
        class: "excalidraw-node",
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ExcalidrawView);
  },
});

function ExcalidrawView(props: NodeViewProps) {
  const { node, updateAttributes, deleteNode, selected, editor } = props;
  const isEditable = editor.isEditable;
  const { theme } = useTheme();

  // Stable identity for this block instance so the board host can highlight
  // the card that is currently open.
  const viewId = React.useId();
  const board = useExcalidrawBoard();
  const isBoardOpen = board?.id === viewId;
  // NodeViews only render on the client (TipTap React renderer), so document
  // is available on first render — no mount effect needed.

  const raw = (node.attrs.data as string | null) ?? null;
  const scene = React.useMemo(() => parseExcalidrawScene(raw), [raw]);
  const sceneKey = React.useMemo(() => hashScene(raw), [raw]);
  const elementCount = React.useMemo(() => countElements(scene), [scene]);
  const excalidrawTheme = resolveTheme(theme);

  // Refs keep the save callback stable for the board store while always
  // writing against the latest node data.
  const rawRef = React.useRef(raw);
  const updateAttributesRef = React.useRef(updateAttributes);
  React.useEffect(() => {
    rawRef.current = raw;
    updateAttributesRef.current = updateAttributes;
  });

  const handleSave = React.useCallback((next: ExcalidrawScene) => {
    const serialized = serializeExcalidrawScene(next);
    if (serialized.length > EXCALIDRAW_MAX_SCENE_CHARS) {
      console.warn(
        "[excalidraw] scene too large, saving anyway",
        serialized.length
      );
    }
    if (serialized !== rawRef.current) {
      updateAttributesRef.current({ data: serialized });
    }
  }, []);

  const selectNode = React.useCallback(() => {
    const pos = props.getPos();
    if (typeof pos !== "number") return;
    try {
      editor.chain().focus().setNodeSelection(pos).run();
    } catch {}
  }, [editor, props]);

  const openBoard = React.useCallback(() => {
    selectNode();
    try {
      editor.commands.blur();
    } catch {
      // blur is best-effort (dismiss mobile keyboard)
    }
    openExcalidrawBoard({
      id: viewId,
      scene,
      theme: excalidrawTheme,
      onSave: handleSave,
    });
  }, [editor, excalidrawTheme, handleSave, scene, selectNode, viewId]);

  return (
    <NodeViewWrapper
      as="div"
      className="excalidraw-node"
      contentEditable={false}
      onMouseDown={(e: React.MouseEvent) => e.stopPropagation()}
    >
      <div
        className={[
          "excalidraw-card",
          selected ? "excalidraw-card-selected" : "",
          isBoardOpen ? "excalidraw-card-board-open" : "",
        ].join(" ")}
        data-excalidraw-card=""
      >
        <div className="excalidraw-card-header">
          <span className="excalidraw-card-title">
            <PenToolIcon className="size-4" />
            Drawing
          </span>
          <span className="excalidraw-card-actions">
            <button
              type="button"
              className="excalidraw-expand-btn excalidraw-open-btn"
              title="Open drawing board"
              aria-label="Open drawing board"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                openBoard();
              }}
            >
              <ExpandIcon className="size-4" />
              <span className="hidden sm:inline">Open</span>
            </button>
            {selected && isEditable && (
              <button
                type="button"
                className="excalidraw-remove-btn"
                title="Remove drawing"
                aria-label="Remove drawing"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  deleteNode();
                }}
              >
                <Trash2Icon className="size-4" />
              </button>
            )}
          </span>
        </div>
        <div
          className="excalidraw-preview"
          onClick={selectNode}
          role="button"
          tabIndex={0}
          aria-label="Drawing preview. Activate Open to edit in this note."
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openBoard();
            }
          }}
        >
          <ExcalidrawLazy
            key={sceneKey}
            initialData={scene}
            theme={excalidrawTheme}
            viewMode
            zenMode
          />
          {elementCount === 0 && (
            <button
              type="button"
              className="excalidraw-empty-overlay"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                openBoard();
              }}
            >
              <PenToolIcon className="size-5" />
              <span>Open board to start drawing</span>
            </button>
          )}
        </div>
      </div>
    </NodeViewWrapper>
  );
}
