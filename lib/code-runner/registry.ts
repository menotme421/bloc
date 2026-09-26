"use client";

import { isPistonRunnerEnabled } from "@/lib/code-runner/piston-client";

/**
 * Single place that decides HOW a code-block language executes.
 *
 * - js:      sandboxed Web Worker (@/lib/code-runner/run-js)
 * - python:  Pyodide WASM in a Worker (@/lib/code-runner/run-python)
 * - cpp:     JSCPP interpreter subset in a Worker (@/lib/code-runner/run-cpp)
 * - preview: sandboxed iframe, no execution (@/lib/code-runner/preview)
 * - remote:  optional Piston proxy (`POST /api/run`) — Java always needs
 *            this; other server-only languages fall back to it when enabled.
 * - none:    not executable in this workspace.
 */

export type RunnerKind =
  | "js"
  | "python"
  | "cpp"
  | "preview"
  | "remote"
  | "none";

/** Canonical lowlight value -> Piston runtime id (null = no remote runtime). */
export function pistonLanguageFor(value: string): string | null {
  const v = value.trim().toLowerCase();
  const map: Record<string, string> = {
    javascript: "javascript",
    js: "javascript",
    jsx: "javascript",
    typescript: "typescript",
    ts: "typescript",
    tsx: "typescript",
    python: "python",
    py: "python",
    bash: "bash",
    shell: "bash",
    sh: "bash",
    c: "c",
    cpp: "c++",
    "c++": "c++",
    java: "java",
    go: "go",
    rust: "rust",
    rs: "rust",
    php: "php",
  };
  return map[v] ?? null;
}

export function runnerFor(language: unknown): RunnerKind {
  const v =
    typeof language === "string" ? language.trim().toLowerCase() : "";
  switch (v) {
    case "javascript":
    case "js":
    case "jsx":
    case "typescript":
    case "ts":
    case "tsx":
      return "js";
    case "python":
    case "py":
      return "python";
    case "c":
    case "cpp":
    case "c++":
      return "cpp";
    case "html":
    case "css":
      return "preview";
    case "java":
      // No lightweight in-browser JVM exists — remote only.
      return isPistonRunnerEnabled && pistonLanguageFor(v) !== null
        ? "remote"
        : "none";
    default:
      return isPistonRunnerEnabled && pistonLanguageFor(v) !== null
        ? "remote"
        : "none";
  }
}

/** Short human-readable badge shown next to run output. */
export function runnerBadge(kind: RunnerKind | "piston"): string {
  switch (kind) {
    case "js":
      return "browser";
    case "python":
      return "pyodide";
    case "cpp":
      return "c++ subset";
    case "preview":
      return "preview";
    case "remote":
    case "piston":
      return "piston";
    case "none":
      return "";
  }
}

/** Tooltip for the Run button per runner kind. */
export function runnerTitle(kind: RunnerKind, language: string): string {
  switch (kind) {
    case "js":
      return "Run JavaScript safely in your browser (no server)";
    case "python":
      return "Run Python in your browser via Pyodide WASM (first run downloads the runtime)";
    case "cpp":
      return "Run a C++ subset in your browser (JSCPP — basic iostream/algorithms; full STL needs remote)";
    case "preview":
      return "HTML/CSS renders as a sandboxed preview below";
    case "remote":
      return `Run ${language} via the remote Piston runner`;
    case "none":
      return language.trim().toLowerCase() === "java"
        ? "Java needs the remote runner — set PISTON_API_KEY / ENABLE_PISTON_RUNNER (see .env.example)"
        : "This language is not runnable in this workspace";
  }
}
