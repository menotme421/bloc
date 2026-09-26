"use client";

/**
 * Shared language list for the Notion-style code block.
 * Values must match the keys registered in `@/lib/code-block-lowlight`
 * (canonical names + common aliases like `js`, `ts`, `py`, `sh`).
 */

export type CodeLanguageOption = {
  value: string;
  label: string;
};

export const LANGUAGE_OPTIONS: CodeLanguageOption[] = [
  { value: "plaintext", label: "Plain text" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "json", label: "JSON" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "markdown", label: "Markdown" },
  { value: "python", label: "Python" },
  { value: "bash", label: "Bash" },
  { value: "shell", label: "Shell" },
  { value: "sql", label: "SQL" },
  { value: "yaml", label: "YAML" },
  { value: "xml", label: "XML" },
  { value: "java", label: "Java" },
  { value: "c", label: "C" },
  { value: "cpp", label: "C++" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
  { value: "php", label: "PHP" },
  { value: "http", label: "HTTP" },
  { value: "ini", label: "INI" },
  { value: "diff", label: "Diff" },
  { value: "makefile", label: "Makefile" },
];

/** Aliases pasted from markdown fences (```js) -> canonical lowlight key. */
const ALIAS_MAP: Record<string, string> = {
  js: "javascript",
  jsx: "javascript",
  ts: "typescript",
  tsx: "typescript",
  py: "python",
  sh: "shell",
  zsh: "bash",
  yml: "yaml",
  md: "markdown",
  html: "html",
  svg: "xml",
  text: "plaintext",
  txt: "plaintext",
  "c++": "cpp",
  rs: "rust",
};

/** Languages runnable 100% in-browser (no server, no cost). */
const LOCALLY_RUNNABLE = new Set([
  "javascript",
  "js",
  "jsx",
  "typescript",
  "ts",
  "tsx",
  "python",
  "py",
  "c",
  "cpp",
  "c++",
  "html",
  "css",
]);

export function normalizeCodeLanguage(raw: unknown): string {
  if (typeof raw !== "string" || !raw.trim()) return "plaintext";
  const lower = raw.trim().toLowerCase();
  const canonical = ALIAS_MAP[lower] ?? lower;
  if (LANGUAGE_OPTIONS.some((o) => o.value === canonical)) return canonical;
  // Unknown language: keep raw so HTML round-trips, highlighting falls back
  // to auto-detect via lowlight. The picker will show "Plain text".
  return raw.trim();
}

/** Value suitable for the <select> (falls back to plaintext for unknowns). */
export function languageForPicker(raw: unknown): string {
  const normalized = normalizeCodeLanguage(raw);
  if (LANGUAGE_OPTIONS.some((o) => o.value === normalized)) return normalized;
  return "plaintext";
}

export function isLocallyRunnable(language: unknown): boolean {
  if (typeof language !== "string") return false;
  const lower = language.trim().toLowerCase();
  return LOCALLY_RUNNABLE.has(lower) || LOCALLY_RUNNABLE.has(ALIAS_MAP[lower] ?? "");
}

export function languageLabel(language: unknown): string {
  const normalized = normalizeCodeLanguage(language);
  return (
    LANGUAGE_OPTIONS.find((o) => o.value === normalized)?.label ?? "Plain text"
  );
}
