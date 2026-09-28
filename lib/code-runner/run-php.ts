"use client";

/**
 * Browser-only PHP runner (php-wasm PHP 8.4 in a Web Worker, $0).
 * Full PHP — much higher fidelity than a subset interpreter.
 */

export type PhpRunResult = {
  output: string;
  exitCode: number | null;
  error: string | null;
  durationMs: number;
};

/** First run downloads ~12-15MB + initialises; allow generous headroom. */
const TIMEOUT_MS = 45000;
const MAX_CODE_CHARS = 50_000;
const MAX_STDIN_CHARS = 10_000;

export function runPhp(
  code: string,
  opts?: { stdin?: string }
): Promise<PhpRunResult> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || typeof Worker === "undefined") {
      resolve({
        output: "",
        exitCode: null,
        error: "Code execution is only available in the browser.",
        durationMs: 0,
      });
      return;
    }
    if (!code.trim()) {
      resolve({ output: "", exitCode: null, error: null, durationMs: 0 });
      return;
    }
    if (code.length > MAX_CODE_CHARS) {
      resolve({
        output: "",
        exitCode: null,
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
    const finish = (partial: PhpRunResult) => {
      if (settled) return;
      settled = true;
      try {
        worker?.terminate();
      } catch {}
      clearTimeout(timer);
      resolve(partial);
    };

    const timer = setTimeout(() => {
      finish({
        output: "",
        exitCode: null,
        error: `Timed out after ${Math.round(TIMEOUT_MS / 1000)}s — possible infinite loop or slow first-time runtime download. Worker terminated.`,
        durationMs: Math.round(performance.now() - started),
      });
    }, TIMEOUT_MS + 250);

    try {
      worker = new Worker(new URL("./php-worker.ts", import.meta.url));
    } catch (e) {
      finish({
        output: "",
        exitCode: null,
        error: e instanceof Error ? e.message : "Could not start worker.",
        durationMs: Math.round(performance.now() - started),
      });
      return;
    }

    worker.onmessage = (ev: MessageEvent) => {
      const msg = ev.data as {
        kind?: string;
        output?: string;
        exitCode?: number | null;
        error?: string | null;
        durationMs?: number;
      };
      if (!msg || msg.kind !== "done") return;
      finish({
        output: typeof msg.output === "string" ? msg.output : "",
        exitCode: typeof msg.exitCode === "number" ? msg.exitCode : null,
        error: typeof msg.error === "string" ? msg.error : null,
        durationMs:
          typeof msg.durationMs === "number"
            ? msg.durationMs
            : Math.round(performance.now() - started),
      });
    };

    worker.onerror = (ev) => {
      finish({
        output: "",
        exitCode: null,
        error: ev.message || "Worker error — snippet could not be executed.",
        durationMs: Math.round(performance.now() - started),
      });
    };

    try {
      worker.postMessage({ code, stdin });
    } catch (e) {
      finish({
        output: "",
        exitCode: null,
        error:
          e instanceof Error ? e.message : "Could not send code to worker.",
        durationMs: Math.round(performance.now() - started),
      });
    }
  });
}
