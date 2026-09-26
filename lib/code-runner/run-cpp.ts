"use client";

/**
 * Browser-only C/C++ runner (JSCPP interpreter subset in a Web Worker, $0).
 *
 * Fidelity note: this is NOT g++. It handles basic iostream/stdio, loops,
 * functions, arrays, and common headers (iostream, cstdio, cstring, cmath,
 * …). Templates-heavy code, most of the STL (vector/map/…), and C++17/20
 * features will fail — the error message says so, and the remote Piston
 * runner remains the full-fidelity path.
 */

export type CppRunResult = {
  output: string;
  exitCode: number | null;
  error: string | null;
  durationMs: number;
};

const TIMEOUT_MS = 8000;
const MAX_CODE_CHARS = 50_000;
const MAX_STDIN_CHARS = 10_000;

export function runCpp(
  code: string,
  opts?: { stdin?: string }
): Promise<CppRunResult> {
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
    const finish = (partial: Omit<CppRunResult, "output"> & { output?: string }) => {
      if (settled) return;
      settled = true;
      try {
        worker?.terminate();
      } catch {}
      clearTimeout(timer);
      resolve({ output: "", ...partial });
    };

    const timer = setTimeout(() => {
      finish({
        exitCode: null,
        error: `Timed out after ${Math.round(TIMEOUT_MS / 1000)}s — possible infinite loop. Worker terminated.`,
        durationMs: Math.round(performance.now() - started),
      });
    }, TIMEOUT_MS + 250);

    try {
      worker = new Worker(new URL("./cpp-worker.ts", import.meta.url));
    } catch (e) {
      finish({
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
      let error = typeof msg.error === "string" ? msg.error : null;
      if (
        error &&
        /vector|map|template|namespace std::\w+|is not defined|no such/i.test(
          error
        )
      ) {
        error +=
          "\nHint: the in-browser runner only supports a C++ subset (basic iostream/stdio). For full STL/g++, enable the remote Piston runner.";
      } else if (
        error &&
        /cin|scanf/.test(code) &&
        !stdin &&
        /input|eof|read/i.test(error)
      ) {
        error +=
          "\nHint: this program reads stdin but none was provided — open Expand and type into the stdin box.";
      }
      finish({
        output: typeof msg.output === "string" ? msg.output : "",
        exitCode: typeof msg.exitCode === "number" ? msg.exitCode : null,
        error,
        durationMs:
          typeof msg.durationMs === "number"
            ? msg.durationMs
            : Math.round(performance.now() - started),
      });
    };

    worker.onerror = (ev) => {
      finish({
        exitCode: null,
        error: ev.message || "Worker error — snippet could not be executed.",
        durationMs: Math.round(performance.now() - started),
      });
    };

    try {
      worker.postMessage({ code, stdin });
    } catch (e) {
      finish({
        exitCode: null,
        error:
          e instanceof Error ? e.message : "Could not send code to worker.",
        durationMs: Math.round(performance.now() - started),
      });
    }
  });
}
