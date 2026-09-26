"use client";

/**
 * Browser-only Python runner (Pyodide WASM in a Web Worker, $0).
 * See `python-worker.ts` for the runtime side.
 */

export type PythonRunResult = {
  stdout: string;
  stderr: string;
  /** stdout+stderr combined, in order (best-effort: stdout then stderr). */
  output: string;
  /** Stringified value of the last expression (null when nothing returned). */
  resultText: string | null;
  error: string | null;
  durationMs: number;
};

/** First run downloads ~7-12MB + initialises; allow generous headroom. */
const TIMEOUT_MS = 30_000;
const MAX_CODE_CHARS = 50_000;
const MAX_STDIN_CHARS = 10_000;

export function runPython(
  code: string,
  opts?: { stdin?: string }
): Promise<PythonRunResult> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || typeof Worker === "undefined") {
      resolve({
        stdout: "",
        stderr: "",
        output: "",
        resultText: null,
        error: "Code execution is only available in the browser.",
        durationMs: 0,
      });
      return;
    }
    if (!code.trim()) {
      resolve({
        stdout: "",
        stderr: "",
        output: "",
        resultText: null,
        error: null,
        durationMs: 0,
      });
      return;
    }
    if (code.length > MAX_CODE_CHARS) {
      resolve({
        stdout: "",
        stderr: "",
        output: "",
        resultText: null,
        error: `Snippet too large (${code.length} chars, max ${MAX_CODE_CHARS}).`,
        durationMs: 0,
      });
      return;
    }

    const started = performance.now();
    const stdin =
      typeof opts?.stdin === "string"
        ? opts.stdin.slice(0, MAX_STDIN_CHARS)
        : "";
    let settled = false;
    let worker: Worker | null = null;
    const finish = (partial: Omit<PythonRunResult, "output">) => {
      if (settled) return;
      settled = true;
      try {
        worker?.terminate();
      } catch {}
      clearTimeout(timer);
      const output = [partial.stdout, partial.stderr]
        .filter(Boolean)
        .join("\n");
      resolve({ ...partial, output });
    };

    const timer = setTimeout(() => {
      finish({
        stdout: "",
        stderr: "",
        resultText: null,
        error: `Timed out after ${Math.round(TIMEOUT_MS / 1000)}s — possible infinite loop or slow first-time runtime download. Worker terminated.`,
        durationMs: Math.round(performance.now() - started),
      });
    }, TIMEOUT_MS + 250);

    try {
      worker = new Worker(new URL("./python-worker.ts", import.meta.url));
    } catch (e) {
      finish({
        stdout: "",
        stderr: "",
        resultText: null,
        error: e instanceof Error ? e.message : "Could not start worker.",
        durationMs: Math.round(performance.now() - started),
      });
      return;
    }

    worker.onmessage = (ev: MessageEvent) => {
      const msg = ev.data as {
        kind?: string;
        stdout?: string;
        stderr?: string;
        resultText?: string | null;
        error?: string | null;
        durationMs?: number;
      };
      if (!msg || msg.kind !== "done") return;
      let error = typeof msg.error === "string" ? msg.error : null;
      if (
        error &&
        /EOFError/.test(error) &&
        !stdin &&
        /input\s*\(/.test(code)
      ) {
        error +=
          "\nHint: this program calls input() but no stdin was provided — open Expand and type into the stdin box.";
      }
      finish({
        stdout: typeof msg.stdout === "string" ? msg.stdout : "",
        stderr: typeof msg.stderr === "string" ? msg.stderr : "",
        resultText: msg.resultText ?? null,
        error,
        durationMs:
          typeof msg.durationMs === "number"
            ? msg.durationMs
            : Math.round(performance.now() - started),
      });
    };

    worker.onerror = (ev) => {
      finish({
        stdout: "",
        stderr: "",
        resultText: null,
        error: ev.message || "Worker error — snippet could not be executed.",
        durationMs: Math.round(performance.now() - started),
      });
    };

    try {
      worker.postMessage({ code, stdin });
    } catch (e) {
      finish({
        stdout: "",
        stderr: "",
        resultText: null,
        error:
          e instanceof Error ? e.message : "Could not send code to worker.",
        durationMs: Math.round(performance.now() - started),
      });
    }
  });
}
