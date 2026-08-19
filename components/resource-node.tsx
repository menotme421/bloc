"use client";

import * as React from "react";
import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { uploadResourceFile } from "@/lib/resource-upload";
import { SquareDimensions } from "@/components/square-dimensions";
import {
  DownloadIcon,
  FileArchiveIcon,
  FileAudioIcon,
  FileCodeIcon,
  FileIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  FileVideoIcon,
  Loader2Icon,
  ShapesIcon,
  Trash2Icon,
} from "lucide-react";

const RESIZE_MIN_WIDTH = 48;

function formatSize(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileTypeIcon({
  type,
  className,
}: {
  type: string;
  className?: string;
}) {
  if (type.startsWith("archive/") || type === "application/zip")
    return <FileArchiveIcon className={className} />;
  if (type.startsWith("audio/"))
    return <FileAudioIcon className={className} />;
  if (type.startsWith("video/"))
    return <FileVideoIcon className={className} />;
  if (
    type.includes("spreadsheet") ||
    type.includes("sheet") ||
    type === "text/csv"
  )
    return <FileSpreadsheetIcon className={className} />;
  if (
    type.includes("pdf") ||
    type.includes("text") ||
    type.includes("json") ||
    type.includes("javascript") ||
    type.includes("html")
  )
    return <FileTextIcon className={className} />;
  if (type.startsWith("text/x-") || type.includes("source"))
    return <FileCodeIcon className={className} />;
  return <FileIcon className={className} />;
}

type ResourceOptions = {
  userId: string;
};

export const Resource = Node.create<ResourceOptions>({
  name: "resource",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addOptions() {
    return {
      userId: "",
    };
  },

  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-src"),
        renderHTML: (attributes) =>
          attributes.src ? { "data-src": attributes.src } : {},
      },
      name: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-name"),
        renderHTML: (attributes) =>
          attributes.name ? { "data-name": attributes.name } : {},
      },
      type: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-type"),
        renderHTML: (attributes) =>
          attributes.type ? { "data-type": attributes.type } : {},
      },
      size: {
        default: null,
        parseHTML: (element) => {
          const raw = element.getAttribute("data-size");
          return raw ? Number(raw) : null;
        },
        renderHTML: (attributes) =>
          attributes.size != null ? { "data-size": String(attributes.size) } : {},
      },
      width: {
        default: null,
        parseHTML: (element) => {
          const raw = element.getAttribute("data-width");
          return raw ? Number(raw) : null;
        },
        renderHTML: (attributes) =>
          attributes.width != null ? { "data-width": String(attributes.width) } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-resource]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-resource": "",
        class: "resource-node",
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResourceView);
  },
});

function ResourceView(props: NodeViewProps) {
  const { node, updateAttributes, deleteNode, selected, editor } = props;
  const userId = props.extension.options.userId;
  const isEditable = editor.isEditable;

  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const [naturalWidth, setNaturalWidth] = React.useState<number | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const imageWrapRef = React.useRef<HTMLDivElement | null>(null);
  const busyRef = React.useRef(false);

  const src = (node.attrs.src as string) ?? null;
  const name = (node.attrs.name as string) ?? "file";
  const type = (node.attrs.type as string) ?? "";
  const size = (node.attrs.size as number) ?? null;
  const width = (node.attrs.width as number) ?? null;
  const isImage = src !== null && type.startsWith("image/");

  React.useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  async function handleFile(file: File) {
    if (busyRef.current) return;
    if (!userId) {
      setError("Uploads are unavailable for this session.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const url = await uploadResourceFile(file, userId);
      updateAttributes({
        src: url,
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    e.target.value = "";
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  function selectNode() {
    const pos = props.getPos();
    if (typeof pos !== "number") return;
    editor.chain().focus().setNodeSelection(pos).run();
  }

  function startResize(e: React.PointerEvent) {
    if (!isEditable) return;
    e.preventDefault();
    e.stopPropagation();
    const base = width ?? naturalWidth ?? 0;
    if (base <= 0) return;
    const startX = e.clientX;
    const container = imageWrapRef.current?.parentElement;
    const maxWidth = container
      ? Math.max(RESIZE_MIN_WIDTH, container.clientWidth)
      : base;
    const onMove = (ev: PointerEvent) => {
      const next = Math.min(maxWidth, Math.max(RESIZE_MIN_WIDTH, base + (ev.clientX - startX)));
      updateAttributes({ width: Math.round(next) });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  if (isImage) {
    return (
      <NodeViewWrapper
        as="div"
        className="resource-node"
        contentEditable={false}
        onMouseDown={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <div
          ref={imageWrapRef}
          className="resource-image-wrap"
          onClick={selectNode}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src ?? undefined}
            alt={name}
            draggable={false}
            className={selected ? "resource-image resource-image-selected" : "resource-image"}
            style={width ? { width: `${width}px` } : undefined}
            onLoad={(e) => {
              const img = e.currentTarget;
              if (!width) {
                updateAttributes({ width: img.naturalWidth });
              }
              setNaturalWidth(img.naturalWidth);
            }}
          />
          {selected && isEditable && (
            <>
              <div className="resource-resize-handle" onPointerDown={startResize}>
                <SquareDimensions className="size-3" />
              </div>
              <button
                type="button"
                className="resource-remove-btn"
                title="Remove resource"
                aria-label="Remove resource"
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
                <Trash2Icon className="size-3.5" />
              </button>
            </>
          )}
        </div>
      </NodeViewWrapper>
    );
  }

  if (src) {
    return (
      <NodeViewWrapper
        as="div"
        className="resource-node"
        contentEditable={false}
        onMouseDown={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <div className="resource-file-card">
          <div className="resource-file-icon">
            <FileTypeIcon type={type} className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {name}
            </p>
            <p className="text-xs text-foreground-muted">
              {formatSize(size)}
              {type ? ` \u00b7 ${type}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <a
              href={src}
              download={name}
              target="_blank"
              rel="noreferrer"
              title="Download"
              className="resource-action-btn"
            >
              <DownloadIcon className="size-4" />
              <span className="hidden sm:inline">Download</span>
            </a>
            {isEditable && (
              <button
                type="button"
                title="Remove resource"
                aria-label="Remove resource"
                className="resource-action-btn"
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  deleteNode();
                }}
              >
                <Trash2Icon className="size-4" />
              </button>
            )}
          </div>
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper
      as="div"
      className="resource-node"
      contentEditable={false}
      onMouseDown={(e: React.MouseEvent) => e.stopPropagation()}
    >
      <div
        className={[
          "resource-upload-card",
          dragOver ? "resource-upload-card-active" : "",
        ].join(" ")}
        onClick={() => !busy && fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={onPickFile}
        />
        {busy ? (
          <>
            <Loader2Icon className="size-5 animate-spin text-foreground-muted" />
            <p className="text-sm text-foreground-muted">{"Uploading\u2026"}</p>
          </>
        ) : (
          <>
            <ShapesIcon className="size-5 text-foreground-muted" />
            <p className="text-sm font-medium text-foreground">Upload a resource</p>
            <p className="text-xs text-foreground-muted">
              Drop a file here or click to browse
            </p>
          </>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </NodeViewWrapper>
  );
}
