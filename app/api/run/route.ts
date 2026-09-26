import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Optional Piston proxy for remote code execution.
 * Disabled by default — set ENABLE_PISTON_RUNNER=true (server) and
 * NEXT_PUBLIC_ENABLE_PISTON_RUNNER=true (client) to enable.
 *
 * Why a proxy instead of calling Piston from the browser:
 * - avoids CORS issues, hides the upstream URL + API key, and lets us enforce
 *   code-size limits + best-effort per-IP rate limiting.
 *
 * IMPORTANT (Feb 2026): the public emkc.org instance is whitelist-only and
 * requires an authorization token. Either:
 * - self-host Piston (MIT, Docker: ghcr.io/engineer-man/piston) and set
 *   PISTON_API_URL=http://your-host:2000/api/v2/execute, or
 * - set PISTON_API_KEY to a token issued by EngineerMan (sent verbatim as the
 *   `Authorization` header).
 *
 * Upstream docs: https://github.com/engineer-man/piston (POST /api/v2/execute)
 */

const PISTON_URL =
  process.env.PISTON_API_URL ?? "https://emkc.org/api/v2/piston/execute";
const PISTON_API_KEY = process.env.PISTON_API_KEY ?? "";

const MAX_CODE_CHARS = 30_000;
const MAX_STDIN_CHARS = 10_000;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_PER_WINDOW = 10;

// Best-effort in-memory rate limit (per isolate — fine as abuse friction,
// not a security boundary; Piston enforces its own quotas upstream).
const hits = new Map<string, number[]>();

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = hits.get(ip) ?? [];
  const fresh = arr.filter((t) => now - t < RATE_WINDOW_MS);
  fresh.push(now);
  hits.set(ip, fresh);
  return fresh.length > RATE_MAX_PER_WINDOW;
}

const LANGUAGE_ALLOWLIST = new Set([
  "javascript",
  "typescript",
  "python",
  "bash",
  "c",
  "c++",
  "java",
  "go",
  "rust",
  "php",
]);

/**
 * Piston picks the entrypoint from the first file; several toolchains care
 * about the filename (notably `javac`, which requires `Main.java` to match
 * `public class Main`). Always send an explicit name.
 */
function fileNameFor(language: string): string {
  switch (language) {
    case "java":
      return "Main.java";
    case "c":
      return "main.c";
    case "c++":
      return "main.cpp";
    case "python":
      return "main.py";
    case "javascript":
    case "typescript":
      return "main.js";
    case "go":
      return "main.go";
    case "rust":
      return "main.rs";
    case "php":
      return "main.php";
    case "bash":
      return "main.sh";
    default:
      return "main.txt";
  }
}

type PistonStage = {
  stdout?: string;
  stderr?: string;
  output?: string;
  code?: number | null;
  signal?: string | null;
};

export async function POST(request: NextRequest) {
  if (process.env.ENABLE_PISTON_RUNNER !== "true") {
    return NextResponse.json(
      { error: "Remote runner is disabled in this workspace." },
      { status: 403 }
    );
  }

  const ip = clientIp(request);
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Rate limited — try again in a minute." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { language, code, stdin } = (body ?? {}) as {
    language?: unknown;
    code?: unknown;
    stdin?: unknown;
  };
  if (typeof language !== "string" || !LANGUAGE_ALLOWLIST.has(language)) {
    return NextResponse.json(
      { error: `Unsupported language. Allowed: ${[...LANGUAGE_ALLOWLIST].join(", ")}.` },
      { status: 400 }
    );
  }
  if (typeof code !== "string" || !code.trim()) {
    return NextResponse.json({ error: "Code is empty." }, { status: 400 });
  }
  if (code.length > MAX_CODE_CHARS) {
    return NextResponse.json(
      { error: `Code too large (${code.length} chars, max ${MAX_CODE_CHARS}).` },
      { status: 400 }
    );
  }
  const stdinText =
    typeof stdin === "string" ? stdin.slice(0, MAX_STDIN_CHARS) : "";

  const started = Date.now();
  try {
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (PISTON_API_KEY) headers["authorization"] = PISTON_API_KEY;
    const upstream = await fetch(PISTON_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        language,
        version: "*",
        files: [{ name: fileNameFor(language), content: code }],
        stdin: stdinText,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!upstream.ok) {
      let hint = "";
      try {
        const text = (await upstream.text()).slice(0, 300);
        if (text) hint = ` Upstream: ${text}`;
      } catch {}
      if (upstream.status === 401 || upstream.status === 403) {
        return NextResponse.json(
          {
            error: `Remote runner rejected the request (${upstream.status}). The public Piston instance is whitelist-only since Feb 2026 — set PISTON_API_KEY or self-host (see .env.example).${hint}`,
          },
          { status: 502 }
        );
      }
      return NextResponse.json(
        { error: `Piston responded with ${upstream.status}.${hint}` },
        { status: 502 }
      );
    }
    const data = (await upstream.json()) as {
      compile?: PistonStage;
      run?: PistonStage;
    };
    const run: PistonStage = data?.run ?? {};
    const compile: PistonStage | undefined = data?.compile;
    const compileFailed =
      typeof compile?.code === "number" && compile.code !== 0;
    return NextResponse.json({
      stdout: run.stdout ?? "",
      stderr: run.stderr ?? "",
      output: run.output ?? "",
      exitCode: typeof run.code === "number" ? run.code : null,
      compile: compile
        ? {
            stdout: compile.stdout ?? "",
            stderr: compile.stderr ?? "",
            output: compile.output ?? "",
            code: typeof compile.code === "number" ? compile.code : null,
          }
        : null,
      error: compileFailed
        ? compile.stderr || compile.output || "Compilation failed."
        : run.signal && run.signal !== "null"
          ? `Terminated with signal ${run.signal}.`
          : null,
      durationMs: Date.now() - started,
    });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error && e.name === "TimeoutError"
            ? "Runner timed out."
            : "Runner request failed.",
      },
      { status: 502 }
    );
  }
}
