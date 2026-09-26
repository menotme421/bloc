"use client";

import type { RunJsResult } from "@/lib/code-runner/run-js";
import type { PythonRunResult } from "@/lib/code-runner/run-python";
import type { CppRunResult } from "@/lib/code-runner/run-cpp";
import type { PistonRunResult } from "@/lib/code-runner/piston-client";

export type JsOutput = { kind: "js"; result: RunJsResult };
export type PythonOutput = { kind: "python"; result: PythonRunResult };
export type CppOutput = { kind: "cpp"; result: CppRunResult };
export type PistonOutput = { kind: "piston"; result: PistonRunResult };
export type RunOutput = JsOutput | PythonOutput | CppOutput | PistonOutput;

/** Plain-text console content for copy + measuring inline size. */
export function consoleText(target: RunOutput): string {
  switch (target.kind) {
    case "js": {
      const parts = target.result.logs.map((l) => l.text);
      if (target.result.resultText) parts.push(target.result.resultText);
      if (target.result.error) parts.push(target.result.error);
      return parts.join("\n");
    }
    case "python": {
      const parts: string[] = [];
      if (target.result.output) parts.push(target.result.output);
      if (target.result.resultText) parts.push(target.result.resultText);
      if (target.result.error) parts.push(target.result.error);
      return parts.join("\n");
    }
    case "cpp": {
      const parts: string[] = [];
      if (target.result.output) parts.push(target.result.output);
      if (target.result.error) parts.push(target.result.error);
      return parts.join("\n");
    }
    case "piston": {
      const r = target.result;
      if (
        r.compile !== null &&
        typeof r.compile.code === "number" &&
        r.compile.code !== 0
      ) {
        return r.compile.stderr || r.compile.output || "Compilation failed.";
      }
      const parts: string[] = [];
      const text =
        r.output || [r.stdout, r.stderr].filter(Boolean).join("\n");
      if (text) parts.push(text);
      if (r.error) parts.push(r.error);
      return parts.join("\n");
    }
  }
}

/** Inline (non-expanded) preview budget — exceeded => "expand to see" notice. */
export const MAX_INLINE_CHARS = 2000;
export const MAX_INLINE_LINES = 30;

export type InlinePreview = {
  truncated: boolean;
  previewText: string;
  totalChars: number;
  totalLines: number;
};

/**
 * Truncate console text for the inline code-block output. Cuts at a line
 * boundary when possible so the preview never shows a half line.
 */
export function getInlinePreview(
  output: RunOutput,
  maxChars: number = MAX_INLINE_CHARS,
  maxLines: number = MAX_INLINE_LINES
): InlinePreview {
  const full = consoleText(output);
  const totalChars = full.length;
  const totalLines = full === "" ? 0 : full.split("\n").length;
  if (totalChars <= maxChars && totalLines <= maxLines) {
    return { truncated: false, previewText: full, totalChars, totalLines };
  }
  const lines = full.split("\n");
  const headLines = lines.slice(0, maxLines).join("\n");
  let previewText =
    headLines.length > maxChars ? headLines.slice(0, maxChars) : headLines;
  // Prefer a line boundary: back up to the last newline within budget.
  if (previewText.length >= maxChars) {
    const lastNewline = previewText.lastIndexOf("\n");
    if (lastNewline > 0) previewText = previewText.slice(0, lastNewline);
  }
  return { truncated: true, previewText, totalChars, totalLines };
}
