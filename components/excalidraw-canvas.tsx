"use client";

import { Excalidraw } from "@excalidraw/excalidraw";
import type {
  ExcalidrawElement,
  OrderedExcalidrawElement,
} from "@excalidraw/excalidraw/element/types";
import type {
  AppState,
  BinaryFiles,
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
} from "@excalidraw/excalidraw/types";
import "@excalidraw/excalidraw/index.css";

export type ExcalidrawScene = {
  elements?: readonly ExcalidrawElement[];
  appState?: Partial<AppState>;
  files?: BinaryFiles;
};

type Props = {
  initialData: ExcalidrawScene | null;
  theme: "light" | "dark";
  viewMode?: boolean;
  zenMode?: boolean;
  onChange?: (
    elements: readonly OrderedExcalidrawElement[],
    appState: AppState,
    files: BinaryFiles
  ) => void;
  onAPI?: (api: ExcalidrawImperativeAPI) => void;
};

/**
 * Thin client-only wrapper over <Excalidraw />.
 * Always imported via next/dynamic(ssr:false) — see excalidraw-lazy.tsx.
 * Container must have non-zero height (docs requirement); parents own sizing.
 */
export default function ExcalidrawCanvas({
  initialData,
  theme,
  viewMode = false,
  zenMode = false,
  onChange,
  onAPI,
}: Props) {
  return (
    <Excalidraw
      initialData={(initialData as ExcalidrawInitialDataState | null) ?? undefined}
      theme={theme}
      viewModeEnabled={viewMode || undefined}
      zenModeEnabled={zenMode || undefined}
      autoFocus={false}
      handleKeyboardGlobally={false}
      detectScroll={false}
      UIOptions={{
        canvasActions: viewMode
          ? {
              clearCanvas: false,
              export: false,
              loadScene: false,
              saveToActiveFile: false,
              toggleTheme: false,
              saveAsImage: false,
            }
          : {
              toggleTheme: false,
            },
      }}
      onChange={onChange}
      excalidrawAPI={onAPI}
    />
  );
}

export type {
  ExcalidrawElement,
  OrderedExcalidrawElement,
  AppState,
  BinaryFiles,
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
};
