"use client";

export function RetryButton() {
  return (
    <button
      onClick={() => window.location.reload()}
      className="inline-flex items-center justify-center rounded-xl border border-border bg-background px-5 py-2.5 text-sm font-medium hover:bg-accent transition"
    >
      Retry
    </button>
  );
}
