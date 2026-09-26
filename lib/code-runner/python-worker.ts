/**
 * Pyodide (CPython compiled to WebAssembly) running inside a dedicated
 * Web Worker — no DOM, no access to the note, localStorage, or cookies.
 *
 * The runtime (~7-12MB) loads lazily from CDN on the FIRST Python run only,
 * then the worker is discarded. Infinite loops are guarded by a timeout +
 * `worker.terminate()`.
 *
 * Limitations (intentional for v1):
 * - Stdlib subset: tkinter/curses/venv and friends are unavailable in WASM.
 * - Third-party packages (numpy/pandas) are not preloaded.
 * - `input()` reads from the `stdin` option (see runPython).
 */

type InMsg = { code: string; stdin: string };

const PYODIDE_VERSION = "0.26.4";
const PYODIDE_BASE = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

const workerScope = self as unknown as {
  onmessage: ((e: MessageEvent<InMsg>) => void) | null;
  postMessage(msg: unknown): void;
  importScripts(...urls: string[]): void;
  loadPyodide?: (opts: { indexURL: string }) => Promise<Pyodide>;
};

type Pyodide = {
  runPythonAsync(code: string): Promise<unknown>;
  setStdout(opts: { batched(s: string): void }): void;
  setStderr(opts: { batched(s: string): void }): void;
  setStdin(opts: { stdin(): number | null }): void;
};

let loadPromise: Promise<Pyodide> | null = null;

function getPyodide(): Promise<Pyodide> {
  if (!loadPromise) {
    loadPromise = (async () => {
      workerScope.importScripts(`${PYODIDE_BASE}pyodide.js`);
      const load = workerScope.loadPyodide;
      if (typeof load !== "function") {
        throw new Error("Pyodide failed to initialise.");
      }
      return load({ indexURL: PYODIDE_BASE });
    })();
  }
  return loadPromise;
}

workerScope.onmessage = async (e) => {
  const { code, stdin } = e.data ?? { code: "", stdin: "" };
  const started = Date.now();
  const post = workerScope.postMessage.bind(workerScope);
  let stdout = "";
  let stderr = "";
  try {
    const py = await getPyodide();
    py.setStdout({
      batched: (s: string) => {
        if (stdout.length < 20_000) stdout += s + "\n";
      },
    });
    py.setStderr({
      batched: (s: string) => {
        if (stderr.length < 20_000) stderr += s + "\n";
      },
    });
    const input = typeof stdin === "string" ? stdin : "";
    if (input) {
      let pos = 0;
      try {
        py.setStdin({
          stdin: () =>
            pos < input.length ? input.charCodeAt(pos++) : null,
        });
      } catch {
        // Older runtime without setStdin — input() will raise EOFError.
      }
    }
    const res = await py.runPythonAsync(code);
    let resultText: string | null = null;
    if (res !== undefined) {
      try {
        const asProxy = res as {
          toString?: () => string;
          destroy?: () => void;
        };
        resultText =
          typeof asProxy?.toString === "function"
            ? String(asProxy.toString())
            : String(res);
        try {
          asProxy?.destroy?.();
        } catch {}
      } catch {
        try {
          resultText = String(res);
        } catch {
          resultText = "[unprintable]";
        }
      }
    }
    post({
      kind: "done",
      stdout,
      stderr,
      resultText,
      durationMs: Date.now() - started,
    });
  } catch (err) {
    post({
      kind: "done",
      stdout,
      stderr,
      resultText: null,
      error:
        err instanceof Error
          ? String(err.message || err).slice(0, 2000)
          : String(err).slice(0, 2000),
      durationMs: Date.now() - started,
    });
  }
};
