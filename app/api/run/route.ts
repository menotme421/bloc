import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Optional remote code runner (Java-only — everything else runs locally).
 * Disabled by default — set ENABLE_PISTON_RUNNER=true (server) and
 * NEXT_PUBLIC_ENABLE_PISTON_RUNNER=true (client) to enable.
 *
 * Two providers (pick one with RUN_PROVIDER):
 * - "piston" (default): self-host Piston (MIT, Docker:
 *   ghcr.io/engineer-man/piston) and set PISTON_API_URL. The public
 *   emkc.org instance is whitelist-only since Feb 2026 — it needs a
 *   PISTON_API_KEY token or it rejects requests.
 * - "jdoodle": JDoodle cloud, no hosting needed. Free account + free API
 *   plan at jdoodle.com (daily free 20 credits, 1 run = 1 credit), then set
 *   JDOODLE_CLIENT_ID + JDOODLE_CLIENT_SECRET (see .env.example).
 *
 * Why a proxy instead of calling the provider from the browser:
 * - avoids CORS issues, hides the upstream URL + API key, and lets us enforce
 *   code-size limits + best-effort per-IP rate limiting.
 *
 * Upstream docs:
 * - https://github.com/engineer-man/piston (POST /api/v2/execute)
 * - https://www.jdoodle.com/docs/compiler-apis/jdoodle-api-quickstart/rest-apis
 *   (POST https://api.jdoodle.com/v1/execute)
 */

const RUN_PROVIDER =
  process.env.RUN_PROVIDER === "jdoodle" ? "jdoodle" : "piston";

const PISTON_URL =
  process.env.PISTON_API_URL ?? "https://emkc.org/api/v2/piston/execute";
const PISTON_API_KEY = process.env.PISTON_API_KEY ?? "";

const JDOODLE_URL = "https://api.jdoodle.com/v1/execute";
const JDOODLE_CLIENT_ID = process.env.JDOODLE_CLIENT_ID ?? "";
const JDOODLE_CLIENT_SECRET = process.env.JDOODLE_CLIENT_SECRET ?? "";
/** JDoodle Java version index (see their Languages page; 5 = JDK 21 LTS). */
const JDOODLE_JAVA_VERSION_INDEX =
  process.env.JDOODLE_JAVA_VERSION_INDEX ?? "5";

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

const LANGUAGE_ALLOWLIST = new Set(["java"]);

/**
 * Piston picks the entrypoint from the first file; `javac` requires
 * `Main.java` to match `public class Main`. Always send an explicit name.
 */
function fileNameFor(language: string): string {
  switch (language) {
    case "java":
      return "Main.java";
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

  if (RUN_PROVIDER === "jdoodle") {
    return runViaJDoodle(language, code, stdinText);
  }
  return runViaPiston(language, code, stdinText);
}

async function runViaPiston(language: string, code: string, stdinText: string) {
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

/**
 * JDoodle cloud provider (no hosting needed — Java-only in this workspace).
 * Same response shape as the Piston path so the client is provider-agnostic.
 * JDoodle replies { output, statusCode, memory, cpuTime, compilationStatus }.
 */
async function runViaJDoodle(
  language: string,
  code: string,
  stdinText: string
) {
  if (!JDOODLE_CLIENT_ID || !JDOODLE_CLIENT_SECRET) {
    return NextResponse.json(
      {
        error:
          "JDoodle credentials are missing — set JDOODLE_CLIENT_ID and JDOODLE_CLIENT_SECRET (free account + free API plan at jdoodle.com, daily free 20 credits; see .env.example).",
      },
      { status: 403 }
    );
  }
  // The proxy allowlist is Java-only; JDoodle's language id for Java is "java".
  if (language !== "java") {
    return NextResponse.json(
      { error: `Unsupported language for the JDoodle provider: ${language}.` },
      { status: 400 }
    );
  }
  const started = Date.now();
  try {
    const upstream = await fetch(JDOODLE_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        clientId: JDOODLE_CLIENT_ID,
        clientSecret: JDOODLE_CLIENT_SECRET,
        script: code,
        stdin: stdinText,
        language: "java",
        versionIndex: JDOODLE_JAVA_VERSION_INDEX,
        compileOnly: false,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!upstream.ok) {
      let hint = "";
      try {
        const text = (await upstream.text()).slice(0, 300);
        if (text) hint = ` Upstream: ${text}`;
      } catch {}
      return NextResponse.json(
        { error: `JDoodle responded with ${upstream.status}.${hint}` },
        { status: 502 }
      );
    }
    const data = (await upstream.json()) as {
      output?: string;
      statusCode?: number;
      memory?: string;
      cpuTime?: string;
      compilationStatus?: number | null;
      error?: string;
    };
    if (typeof data?.error === "string" && data.error) {
      return NextResponse.json(
        { error: `JDoodle error: ${data.error.slice(0, 300)}` },
        { status: 502 }
      );
    }
    const output = typeof data?.output === "string" ? data.output : "";
    const statusCode = typeof data?.statusCode === "number" ? data.statusCode : 0;
    const compilationStatus =
      typeof data?.compilationStatus === "number"
        ? data.compilationStatus
        : null;
    const compileFailed =
      compilationStatus !== null && compilationStatus !== 0;
    const failed = statusCode !== 200 || compileFailed;
    return NextResponse.json({
      stdout: output,
      stderr: failed ? output : "",
      output,
      exitCode: failed ? null : 0,
      compile:
        compilationStatus !== null
          ? {
              stdout: "",
              stderr: compileFailed ? output : "",
              output,
              code: compilationStatus,
            }
          : null,
      error: failed
        ? output || `JDoodle run failed (status ${statusCode}).`
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
