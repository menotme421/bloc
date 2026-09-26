"use client";

/**
 * Client for the optional Piston proxy (`POST /api/run`).
 * Disabled unless `NEXT_PUBLIC_ENABLE_PISTON_RUNNER === "true"`.
 *
 * NOTE (Feb 2026): the public emkc.org instance is whitelist-only and needs
 * an authorization token. Point PISTON_API_URL at a self-hosted instance or
 * set PISTON_API_KEY server-side — see `.env.example` and `app/api/run/route.ts`.
 */

export const isPistonRunnerEnabled =
  typeof process !== "undefined" &&
  process.env.NEXT_PUBLIC_ENABLE_PISTON_RUNNER === "true";

export type PistonStageResult = {
  stdout: string;
  stderr: string;
  output: string;
  code: number | null;
};

export type PistonRunResult = {
  stdout: string;
  stderr: string;
  output: string;
  exitCode: number | null;
  error: string | null;
  compile: PistonStageResult | null;
  durationMs: number;
};

const MAX_STDIN_CHARS = 10_000;

export async function runViaPiston(
  language: string,
  code: string,
  opts?: { stdin?: string }
): Promise<PistonRunResult> {
  const started = typeof performance !== "undefined" ? performance.now() : 0;
  const fail = (error: string): PistonRunResult => ({
    stdout: "",
    stderr: "",
    output: "",
    exitCode: null,
    error,
    compile: null,
    durationMs:
      typeof performance !== "undefined"
        ? Math.round(performance.now() - started)
        : 0,
  });

  const stdin =
    typeof opts?.stdin === "string" ? opts.stdin.slice(0, MAX_STDIN_CHARS) : "";
  let res: Response;
  try {
    res = await fetch("/api/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ language, code, stdin }),
    });
  } catch {
    return fail("Could not reach the remote runner.");
  }
  const durationMs =
    typeof performance !== "undefined"
      ? Math.round(performance.now() - started)
      : 0;
  if (!res.ok) {
    let message = `Runner responded with ${res.status}.`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data?.error) message = data.error;
    } catch {}
    return {
      stdout: "",
      stderr: "",
      output: "",
      exitCode: null,
      error: message,
      compile: null,
      durationMs,
    };
  }
  const data = (await res.json()) as Partial<PistonRunResult>;
  const compile =
    data.compile && typeof data.compile === "object"
      ? {
          stdout:
            typeof data.compile.stdout === "string"
              ? data.compile.stdout
              : "",
          stderr:
            typeof data.compile.stderr === "string"
              ? data.compile.stderr
              : "",
          output:
            typeof data.compile.output === "string"
              ? data.compile.output
              : "",
          code:
            typeof data.compile.code === "number" ? data.compile.code : null,
        }
      : null;
  return {
    stdout: typeof data.stdout === "string" ? data.stdout : "",
    stderr: typeof data.stderr === "string" ? data.stderr : "",
    output: typeof data.output === "string" ? data.output : "",
    exitCode: typeof data.exitCode === "number" ? data.exitCode : null,
    error: typeof data.error === "string" ? data.error : null,
    compile,
    durationMs:
      typeof data.durationMs === "number" ? data.durationMs : durationMs,
  };
}
