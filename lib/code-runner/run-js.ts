"use client";

/**
 * Minimal sandboxed JavaScript runner (browser-only, $0, offline-capable).
 *
 * Security model:
 * - Code runs in a dedicated Web Worker created from a Blob URL — no DOM,
 *   no access to the note, localStorage, or cookies.
 * - `fetch`, `XMLHttpRequest`, `importScripts`, and `WebSocket` are nulled
 *   inside the worker before user code runs (best-effort network isolation).
 * - Infinite loops are guarded by a timeout + `worker.terminate()`.
 * - `console.*` is captured and returned; the completion value is shown too.
 *
 * Limitations (intentional for v1):
 * - TypeScript runs as-is: plain-JS-compatible TS works, type annotations
 *   that aren't valid JS will surface as a SyntaxError with a hint.
 * - No `import`/`require` — single-file snippets only.
 */

export type RunLog = {
  type: "log" | "error" | "warn" | "info";
  text: string;
};

export type RunJsResult = {
  logs: RunLog[];
  /** Stringified completion value (undefined when the snippet returns nothing). */
  resultText: string | null;
  error: string | null;
  durationMs: number;
};

const DEFAULT_TIMEOUT_MS = 5000;
const MAX_CODE_CHARS = 50_000;

function buildWorkerSource(): string {
  return `
    const stringify = (v) => {
      if (typeof v === "string") return v;
      try {
        const j = JSON.stringify(v);
        return j === undefined ? String(v) : j;
      } catch { try { return String(v); } catch { return "[unprintable]"; } }
    };
    const send = (type, args) => {
      self.postMessage({ kind: "log", type, text: args.map(stringify).join(" ") });
    };
    // Best-effort network isolation for untrusted snippets.
    try {
      self.fetch = undefined;
      self.XMLHttpRequest = undefined;
      self.WebSocket = undefined;
      self.EventSource = undefined;
      self.importScripts = undefined;
    } catch {}
    self.onmessage = async (e) => {
      const { code } = e.data || {};
      const started = Date.now();
      const fakeConsole = {
        log: (...a) => send("log", a),
        error: (...a) => send("error", a),
        warn: (...a) => send("warn", a),
        info: (...a) => send("info", a),
      };
      try {
        // Wrap in an async IIFE so top-level await works in snippets.
        const fn = new Function(
          "console",
          '"use strict"; return (async () => {\\n" + code + "\\n})();'
        );
        const value = await fn(fakeConsole);
        self.postMessage({
          kind: "done",
          resultText: value === undefined ? null : stringify(value),
          durationMs: Date.now() - started,
        });
      } catch (err) {
        self.postMessage({
          kind: "done",
          resultText: null,
          error: err && err.stack ? String(err.stack).split("\\n").slice(0, 4).join("\\n") : String(err),
          durationMs: Date.now() - started,
        });
      }
    };
  `;
}

export function runJavaScript(
  code: string,
  opts?: { timeoutMs?: number }
): Promise<RunJsResult> {
  const timeoutMs = Math.min(
    Math.max(opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS, 500),
    15_000
  );

  return new Promise((resolve) => {
    if (typeof window === "undefined" || typeof Worker === "undefined") {
      resolve({
        logs: [],
        resultText: null,
        error: "Code execution is only available in the browser.",
        durationMs: 0,
      });
      return;
    }
    if (!code.trim()) {
      resolve({ logs: [], resultText: null, error: null, durationMs: 0 });
      return;
    }
    if (code.length > MAX_CODE_CHARS) {
      resolve({
        logs: [],
        resultText: null,
        error: `Snippet too large (${code.length} chars, max ${MAX_CODE_CHARS}).`,
        durationMs: 0,
      });
      return;
    }

    const started = performance.now();
    const logs: RunLog[] = [];
    let settled = false;

    let worker: Worker | null = null;
    let blobUrl: string | null = null;
    const finish = (partial: Omit<RunJsResult, "logs">) => {
      if (settled) return;
      settled = true;
      try {
        worker?.terminate();
      } catch {}
      if (blobUrl) {
        try {
          URL.revokeObjectURL(blobUrl);
        } catch {}
      }
      clearTimeout(timer);
      resolve({ logs, ...partial });
    };

    const timer = setTimeout(() => {
      finish({
        resultText: null,
        error: `Timed out after ${timeoutMs}ms — possible infinite loop. Worker terminated.`,
        durationMs: Math.round(performance.now() - started),
      });
    }, timeoutMs + 250);

    try {
      const blob = new Blob([buildWorkerSource()], {
        type: "text/javascript",
      });
      blobUrl = URL.createObjectURL(blob);
      worker = new Worker(blobUrl);
    } catch (e) {
      finish({
        resultText: null,
        error: e instanceof Error ? e.message : "Could not start worker.",
        durationMs: Math.round(performance.now() - started),
      });
      return;
    }

    worker.onmessage = (ev: MessageEvent) => {
      const msg = ev.data as
        | { kind: "log"; type: RunLog["type"]; text: string }
        | {
            kind: "done";
            resultText: string | null;
            error?: string | null;
            durationMs: number;
          };
      if (!msg || typeof msg !== "object") return;
      if (msg.kind === "log") {
        if (logs.length < 200) {
          const type: RunLog["type"] =
            msg.type === "error" ||
            msg.type === "warn" ||
            msg.type === "info" ||
            msg.type === "log"
              ? msg.type
              : "log";
          logs.push({ type, text: String(msg.text).slice(0, 4000) });
        }
        return;
      }
      if (msg.kind === "done") {
        let error = msg.error ?? null;
        // Friendly hint for TS-only syntax run as JS.
        if (
          error &&
          /Unexpected token|Cannot find name|is not defined/.test(error) === false
        ) {
          // keep as-is; hint appended below only for likely type syntax
        }
        if (
          error &&
          /^(Unexpected token|.*':'.*expected)/.test(code.slice(0, 200)) === false &&
          /:\s*(string|number|boolean|void|any)\b/.test(code) &&
          /SyntaxError|Unexpected token/.test(error)
        ) {
          error +=
            "\nHint: this looks like TypeScript type syntax — remove type annotations or switch the block to JavaScript.";
        }
        finish({
          resultText: msg.resultText ?? null,
          error,
          durationMs:
            typeof msg.durationMs === "number"
              ? msg.durationMs
              : Math.round(performance.now() - started),
        });
      }
    };

    worker.onerror = (ev) => {
      finish({
        resultText: null,
        error:
          ev.message || "Worker error — snippet could not be executed.",
        durationMs: Math.round(performance.now() - started),
      });
    };

    try {
      worker.postMessage({ code });
    } catch (e) {
      finish({
        resultText: null,
        error: e instanceof Error ? e.message : "Could not send code to worker.",
        durationMs: Math.round(performance.now() - started),
      });
    }
  });
}
