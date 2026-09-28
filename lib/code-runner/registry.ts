"use client";

import { isPistonRunnerEnabled } from "@/lib/code-runner/piston-client";

/**
 * Single place that decides HOW a code-block language executes.
 *
 * Supported languages: JavaScript/TypeScript, Python, C/C++, PHP, Java,
 * HTML/CSS. Anything else is highlight-only.
 *
 * - js:      sandboxed Web Worker (@/lib/code-runner/run-js)
 * - python:  Pyodide WASM in a Worker (@/lib/code-runner/run-python)
 * - cpp:     JSCPP interpreter subset in a Worker (@/lib/code-runner/run-cpp)
 * - php:     php-wasm PHP 8.4 in a Worker (@/lib/code-runner/run-php)
 * - preview: sandboxed iframe, no execution (@/lib/code-runner/preview)
 * - remote:  optional Piston proxy (`POST /api/run`) — Java only, since no
 *            lightweight in-browser JVM exists.
 * - none:    not executable in this workspace.
 */

export type RunnerKind =
  | "js"
  | "python"
  | "cpp"
  | "php"
  | "preview"
  | "remote"
  | "none";

/**
 * Canonical lowlight value -> Piston runtime id (null = no remote runtime).
 * Only Java runs remotely — everything else runnable is local.
 */
export function pistonLanguageFor(value: string): string | null {
  const v = value.trim().toLowerCase();
  return v === "java" ? "java" : null;
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
    case "php":
      return "php";
    case "html":
    case "css":
      return "preview";
    case "java":
      // No lightweight in-browser JVM exists — remote only.
      return isPistonRunnerEnabled ? "remote" : "none";
    default:
      return "none";
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
    case "php":
      return "php-wasm";
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
      return "Run a C++ subset in your browser (JSCPP — basic iostream/algorithms)";
    case "php":
      return "Run PHP 8.4 in your browser via php-wasm (first run downloads the runtime)";
    case "preview":
      return "HTML/CSS renders as a sandboxed preview below";
    case "remote":
      return `Run ${language} via the remote Piston runner`;
    case "none":
      return language.trim().toLowerCase() === "java"
        ? "Java needs the remote runner — set RUN_PROVIDER=jdoodle with JDOODLE_CLIENT_ID/SECRET, or self-host Piston (see .env.example)"
        : "This language is not runnable in this workspace";
  }
}
