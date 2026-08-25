"use client";

import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const TAG_PALETTE = [
  { bg: "#fde68a", fg: "#78350f" },
  { bg: "#fbcfe8", fg: "#831843" },
  { bg: "#bfdbfe", fg: "#1e3a8a" },
  { bg: "#bbf7d0", fg: "#14532d" },
  { bg: "#ddd6fe", fg: "#4c1d95" },
  { bg: "#fed7aa", fg: "#7c2d12" },
  { bg: "#a5f3fc", fg: "#164e63" },
  { bg: "#fecaca", fg: "#7f1d1d" },
];

function tagColor(tag: string) {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = (hash * 31 + tag.charCodeAt(i)) >>> 0;
  }
  return TAG_PALETTE[hash % TAG_PALETTE.length];
}

export function TagChip({
  tag,
  onRemove,
  onClick,
  className,
  tabIndex,
  onKeyDown,
}: {
  tag: string;
  onRemove?: () => void;
  onClick?: () => void;
  className?: string;
  tabIndex?: number;
  onKeyDown?: (event: React.KeyboardEvent) => void;
}) {
  const { bg, fg } = tagColor(tag);

  const content = (
    <>
      <span className="truncate">{tag}</span>
      {onRemove && (
        <button
          type="button"
          aria-label={`Remove tag ${tag}`}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="-mr-0.5 grid size-4 shrink-0 cursor-pointer place-items-center rounded-full opacity-70 transition-opacity hover:bg-black/10 hover:opacity-100"
        >
          <XIcon className="size-3" />
        </button>
      )}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        tabIndex={tabIndex}
        onKeyDown={onKeyDown}
        style={{ backgroundColor: bg, color: fg }}
        className={cn(
          "inline-flex h-6 max-w-52 shrink-0 cursor-pointer items-center gap-1 rounded-full px-2.5 text-xs font-medium whitespace-nowrap outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/50 hover:opacity-90 active:scale-95 touch-manipulation",
          onRemove && "pr-1",
          className
        )}
      >
        {content}
      </button>
    );
  }

  return (
    <span
      tabIndex={tabIndex}
      onKeyDown={onKeyDown}
      style={{ backgroundColor: bg, color: fg }}
      className={cn(
        "inline-flex h-6 max-w-52 shrink-0 cursor-default items-center gap-1 rounded-full px-2.5 text-xs font-medium whitespace-nowrap outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/50",
        onRemove && "pr-1",
        className
      )}
    >
      {content}
    </span>
  );
}