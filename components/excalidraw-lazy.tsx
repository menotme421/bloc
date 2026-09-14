"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type ExcalidrawCanvas from "./excalidraw-canvas";

type CanvasProps = ComponentProps<typeof ExcalidrawCanvas>;

/**
 * SSR-disabled loader for the heavy Excalidraw bundle.
 * Excalidraw doesn't support SSR (docs: dynamic import, ssr:false).
 * Mount only when needed (preview + open dialog) to keep note load fast.
 */
export const ExcalidrawLazy = dynamic(() => import("./excalidraw-canvas"), {
  ssr: false,
  loading: () => (
    <div className="excalidraw-loading">
      <p className="text-sm text-muted-foreground">Loading canvas…</p>
    </div>
  ),
}) as unknown as typeof ExcalidrawCanvas;

export type { CanvasProps };
