/**
 * JSCPP (C/C++ interpreter) running inside a dedicated Web Worker.
 * Interpreted + synchronous, so it MUST NOT run on the main thread:
 * an infinite loop would freeze the tab. The host terminates the worker
 * on timeout (see `run-cpp.ts`).
 */

import JSCPP from "JSCPP";

type InMsg = { code: string; stdin: string };

const workerScope = self as unknown as {
  onmessage: ((e: MessageEvent<InMsg>) => void) | null;
  postMessage(msg: unknown): void;
};

const MAX_OUTPUT_CHARS = 20_000;

workerScope.onmessage = (e) => {
  const { code, stdin } = e.data ?? { code: "", stdin: "" };
  const started = Date.now();
  const post = workerScope.postMessage.bind(workerScope);
  let output = "";
  try {
    const exitCode = JSCPP.run(typeof code === "string" ? code : "", typeof stdin === "string" ? stdin : "", {
      stdio: {
        write: (s: string) => {
          if (output.length < MAX_OUTPUT_CHARS) output += s;
        },
      },
    });
    post({
      kind: "done",
      output,
      exitCode: typeof exitCode === "number" ? exitCode : 0,
      durationMs: Date.now() - started,
    });
  } catch (err) {
    post({
      kind: "done",
      output,
      exitCode: null,
      error:
        err instanceof Error
          ? String(err.message || err).slice(0, 2000)
          : String(err).slice(0, 2000),
      durationMs: Date.now() - started,
    });
  }
};
