"use client";

import * as React from "react";
import { ArrowLeftIcon, CheckIcon, PenToolIcon } from "lucide-react";
import { ExcalidrawLazy } from "./excalidraw-lazy";
import type {
  AppState,
  BinaryFiles,
  ExcalidrawScene,
  OrderedExcalidrawElement,
} from "./excalidraw-canvas";

const SAVE_DEBOUNCE_MS = 800;

export type BoardRequest = {
  /** Stable id of the drawing block that opened the board. */
  id: string;
  scene: ExcalidrawScene | null;
  theme: "light" | "dark";
  onSave: (scene: ExcalidrawScene) => void;
};

// ── Tiny external store (intentionally NOT React context) ───────────────
// TipTap NodeViews render in their own React roots, so context provided by
// NoteEditor would not reach them. A module-level store works from any tree.
let active: BoardRequest | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // ignore listener errors
    }
  }
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function getSnapshot(): BoardRequest | null {
  return active;
}

function getServerSnapshot(): BoardRequest | null {
  return null;
}

export function openExcalidrawBoard(request: BoardRequest) {
  active = request;
  emit();
}

export function closeExcalidrawBoard() {
  active = null;
  emit();
}

export function useExcalidrawBoard(): BoardRequest | null {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Host rendered by the note screen. When a board is open it takes over the
 * note content area (below the note title) so drawing feels like staying
 * inside the same note — no modal overlay.
 */
export function ExcalidrawBoardHost({ noteTitle }: { noteTitle: string }) {
  const board = useExcalidrawBoard();
  if (!board) return null;
  return (
    <ExcalidrawBoard key={board.id} request={board} noteTitle={noteTitle} />
  );
}

function ExcalidrawBoard({
  request,
  noteTitle,
}: {
  request: BoardRequest;
  noteTitle: string;
}) {
  const latestRef = React.useRef<ExcalidrawScene | null>(null);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSaveRef = React.useRef(request.onSave);

  React.useEffect(() => {
    onSaveRef.current = request.onSave;
  }, [request]);

  // True while strokes are waiting to be written into the note.
  const [pending, setPending] = React.useState(false);

  const flush = React.useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (latestRef.current) {
      try {
        onSaveRef.current(latestRef.current);
      } catch {
        // saving must never break closing the board
      }
      latestRef.current = null;
    }
    setPending(false);
  }, []);

  // Safety net: flush pending strokes if the board unmounts for any reason
  // (navigation, switching to another board) before an explicit close.
  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (latestRef.current) {
        try {
          onSaveRef.current(latestRef.current);
        } catch {
          // ignore
        }
        latestRef.current = null;
      }
    };
  }, []);

  const handleClose = React.useCallback(() => {
    flush();
    closeExcalidrawBoard();
  }, [flush]);

  // Escape backs out of the board — unless Excalidraw itself consumed the
  // keypress (e.g. deselecting a shape), in which case leave it alone.
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) {
        e.preventDefault();
        handleClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleClose]);

  const handleChange = React.useCallback(
    (
      elements: readonly OrderedExcalidrawElement[],
      appState: AppState,
      files: BinaryFiles
    ) => {
      latestRef.current = {
        elements,
        appState: { viewBackgroundColor: appState.viewBackgroundColor },
        files,
      };
      setPending(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        if (latestRef.current) {
          try {
            onSaveRef.current(latestRef.current);
          } catch {
            // ignore; close-flush will retry
          }
          // keep latestRef so close-flush still has it; cheap + idempotent
        }
        setPending(false);
      }, SAVE_DEBOUNCE_MS);
    },
    []
  );

  return (
    <div className="excalidraw-board" data-excalidraw-board="">
      <div className="excalidraw-board-header">
        <button
          type="button"
          className="excalidraw-expand-btn excalidraw-board-back"
          title="Back to note"
          aria-label="Back to note"
          onClick={handleClose}
        >
          <ArrowLeftIcon className="size-4 shrink-0" />
          <span className="excalidraw-board-back-label">
            {noteTitle.trim() || "Back to note"}
          </span>
        </button>
        <span className="excalidraw-card-title">
          <PenToolIcon className="size-4" />
          Drawing
          <span className="excalidraw-card-count">
            {pending ? "Saving…" : "Saved"}
          </span>
        </span>
        <button
          type="button"
          className="excalidraw-board-done"
          title="Save and back to note"
          aria-label="Save and back to note"
          onClick={handleClose}
        >
          <CheckIcon className="size-4" />
          <span>Done</span>
        </button>
      </div>
      <div className="excalidraw-board-body">
        <ExcalidrawLazy
          initialData={request.scene}
          theme={request.theme}
          onChange={handleChange}
        />
      </div>
    </div>
  );
}
