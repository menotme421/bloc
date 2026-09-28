"use client";

/**
 * Browser-only C/C++ runner (JSCPP interpreter subset in a Web Worker, $0).
 *
 * Fidelity note: this is NOT g++. It handles basic iostream/stdio, loops,
 * functions, arrays, and common headers (iostream, cstdio, cstring, cmath,
 * …). It does NOT understand `::` scope resolution (write `cout`, not
 * `std::cout`, with `using namespace std;`). Templates-heavy code, most of
 * the STL (vector/map/…), and C++17/20 features will fail — the error
 * message says so.
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

/**
 * The bundled JSCPP grammar has no `::` scope-resolution operator, so even
 * `std::cout` fails to parse — yet it resolves unqualified `cout`/`cin`/`endl`
 * without any `using namespace` directive (verified). Rewrite the iostream
 * stream objects to their unqualified form before execution.
 *
 * Deliberately narrow (stream objects only): anything else qualified
 * (`std::vector`, `MyClass::method`, …) still fails, and the error hint
 * below explains why. Known edge: `std::cout` inside a string literal or
 * comment is rewritten too — accepted over a hard parse failure.
 */
const STD_STREAM_NAMES = "cout|cin|cerr|clog|endl|flush|ends";

function normalizeStdStreaming(code: string): string {
  return code.replace(
    new RegExp(`\\bstd::(${STD_STREAM_NAMES})\\b`, "g"),
    "$1"
  );
}

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
    // Unqualify iostream stream objects for the subset grammar (see above).
    // Error hints below still inspect the ORIGINAL code.
    const runnableCode = normalizeStdStreaming(code);
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
      const parseFailed =
        !!error && /Parsing Failure|":" found/.test(error);
      const stlInCode =
        /#include\s*<(vector|string|map|set|array|algorithm|unordered_map|bits\/)|std::(vector|string|map|set|array|deque|list|stack|queue|pair|template)/i.test(
          code
        );
      if (error && /cannot find library/i.test(error)) {
        error +=
          "\nHint: that header isn't in this runner's supported set (iostream, cstdio, cstring, cmath, …). Templates and most of the STL need a full g++ toolchain, which isn't available in this workspace.";
      } else if (error && parseFailed && stlInCode) {
        error +=
          "\nHint: the in-browser runner only supports a C++ subset (basic iostream/stdio, loops, functions, arrays). Templates, most STL containers (vector/map/…), and C++17/20 features need a full g++ toolchain, which isn't available in this workspace.";
      } else if (error && parseFailed && /::/.test(code)) {
        // `std::cout/cin/endl` are rewritten automatically before execution;
        // anything else qualified still fails — the grammar has no `::` at all.
        error +=
          "\nHint: this runner's grammar has no `::` scope operator — qualified names other than the auto-rewritten iostream streams (e.g. your own `Class::method`, `std::this_thread`) aren't supported.";
      } else if (
        error &&
        /vector|map|template|is not defined|no such/i.test(error)
      ) {
        error +=
          "\nHint: the in-browser runner only supports a C++ subset (basic iostream/stdio, loops, functions, arrays). Templates, most STL containers (vector/map/…), and C++17/20 features need a full g++ toolchain, which isn't available in this workspace.";
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
      worker.postMessage({ code: runnableCode, stdin });
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
