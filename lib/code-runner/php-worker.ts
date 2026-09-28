/**
 * php-wasm (PHP 8.4 compiled to WebAssembly) inside a dedicated Web Worker.
 * First run downloads ~12-15MB + initialises; the host allows generous
 * headroom and terminates the worker on timeout (see run-php.ts).
 *
 * Two worker-specific workarounds live here:
 * - Emscripten's JSEvents evaluates `specialHTMLTargets=[0,document,window]`
 *   at instantiation, so minimal `window`/`document`/`screen` shims are
 *   installed first (snippets never touch the DOM; only the init path does).
 * - The bundler never emits the content-hashed `.wasm` asset, so `locateFile`
 *   points Emscripten at the jsDelivr CDN copy of this exact version.
 */

import { PhpWeb } from "php-wasm/PhpWeb";

type InMsg = { code: string; stdin: string };

const workerScope = self as unknown as {
  onmessage: ((e: MessageEvent<InMsg>) => void) | null;
  postMessage(msg: unknown): void;
};

const PHP_WASM_CDN = "https://cdn.jsdelivr.net/npm/php-wasm@0.1.0";

function installWorkerShims(): void {
  const g = workerScope as unknown as Record<string, unknown>;
  if (typeof g["window"] === "undefined") g["window"] = g;
  if (typeof g["document"] === "undefined") {
    g["document"] = {
      fullscreenEnabled: false,
      webkitFullscreenEnabled: false,
      currentScript: null,
      querySelector: () => null,
      createElement: () => null,
      getElementById: () => null,
    };
  }
  if (typeof g["screen"] === "undefined") g["screen"] = {};
}

installWorkerShims();

const MAX_OUTPUT_CHARS = 20_000;

function withPhpTag(code: string): string {
  if (/<\?(php|=)/i.test(code)) return code;
  return `<?php\n${code}`;
}

workerScope.onmessage = async (e) => {
  const { code, stdin } = e.data ?? { code: "", stdin: "" };
  const started = Date.now();
  const post = workerScope.postMessage.bind(workerScope);
  let stdout = "";
  let stderr = "";
  try {
    const php = new PhpWeb({
      locateFile: (path: string) =>
        `${PHP_WASM_CDN}/${String(path).split("/").pop()}`,
    }) as unknown as {
      addEventListener(type: string, cb: (ev: { detail: unknown }) => void): void;
      inputString(s: string): unknown;
      run(code: string): Promise<unknown>;
    };
    php.addEventListener("output", (ev) => {
      const s = typeof ev.detail === "string" ? ev.detail : String(ev.detail ?? "");
      if (stdout.length < MAX_OUTPUT_CHARS) {
        stdout += s.slice(0, MAX_OUTPUT_CHARS - stdout.length);
      }
    });
    php.addEventListener("error", (ev) => {
      const s = typeof ev.detail === "string" ? ev.detail : String(ev.detail ?? "");
      if (stderr.length < MAX_OUTPUT_CHARS) {
        stderr += s.slice(0, MAX_OUTPUT_CHARS - stderr.length);
      }
    });
    if (typeof stdin === "string" && stdin) {
      try {
        await php.inputString(stdin);
      } catch {}
    }
    const exitCode = await php.run(withPhpTag(typeof code === "string" ? code : ""));
    const output = [stdout, stderr].filter(Boolean).join("\n");
    post({
      kind: "done",
      output,
      exitCode: typeof exitCode === "number" ? exitCode : null,
      error:
        typeof exitCode === "number" && exitCode !== 0 && !output
          ? `PHP exited with code ${exitCode}.`
          : null,
      durationMs: Date.now() - started,
    });
  } catch (err) {
    post({
      kind: "done",
      output: [stdout, stderr].filter(Boolean).join("\n"),
      exitCode: null,
      error:
        err instanceof Error
          ? String(err.message || err).slice(0, 2000)
          : String(err).slice(0, 2000),
      durationMs: Date.now() - started,
    });
  }
};
