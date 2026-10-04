"use client";

import * as React from "react";
import {
  ArrowLeftIcon,
  CheckIcon,
  Code2Icon,
  CopyIcon,
  KeyboardIcon,
  Loader2Icon,
  PlayIcon,
  TerminalIcon,
  XIcon,
} from "lucide-react";
import {
  groupedLanguageOptions,
  languageForPicker,
  languageLabel,
  normalizeCodeLanguage,
} from "@/lib/code-block-languages";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { runJavaScript } from "@/lib/code-runner/run-js";
import { runPython } from "@/lib/code-runner/run-python";
import { runCpp } from "@/lib/code-runner/run-cpp";
import { runPhp } from "@/lib/code-runner/run-php";
import { runViaPiston } from "@/lib/code-runner/piston-client";
import {
  consoleText,
  type RunOutput,
} from "@/lib/code-runner/run-output";
import { buildPreviewSrcDoc } from "@/lib/code-runner/preview";
import {
  pistonLanguageFor,
  runnerFor,
  runnerTitle,
} from "@/lib/code-runner/registry";

export type CodeIdeRequest = {
  /** Stable id of the code block that opened the IDE. */
  id: string;
  language: string;
  code: string;
  onSave: (code: string, language: string) => void;
  /** Stylesheet of the directly-following CSS block (HTML only). */
  siblingCss?: string | null;
  /** Last run output from the inline block (session-only), if any. */
  initialOutput?: RunOutput | null;
  /** Called on run/clear so the inline block shows the same output on Back. */
  onOutput?: (output: RunOutput | null) => void;
};

  const SAVE_DEBOUNCE_MS = 800;

/** localStorage key for the remembered editor/output split (fraction). */
const SPLIT_KEY = "bloc:code-ide-split";
const SPLIT_MIN = 0.15;
const SPLIT_MAX = 0.85;

function loadSplit(): number | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(SPLIT_KEY);
    if (raw === null) return null;
    const v = Number(raw);
    if (Number.isFinite(v) && v >= SPLIT_MIN && v <= SPLIT_MAX) return v;
  } catch {}
  return null;
}

// ── Tiny external store (intentionally NOT React context) ───────────────
// TipTap NodeViews render in their own React roots, so context provided by
// NoteEditor would not reach them. A module-level store works from any tree.
// Mirrors components/excalidraw-board.tsx.
let active: CodeIdeRequest | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // ignore listener errors
    }
  }
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function getSnapshot(): CodeIdeRequest | null {
  return active;
}

function getServerSnapshot(): CodeIdeRequest | null {
  return null;
}

export function openCodeIDE(request: CodeIdeRequest) {
  active = request;
  emit();
}

export function closeCodeIDE() {
  active = null;
  emit();
}

export function useCodeIDE(): CodeIdeRequest | null {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Host rendered by the note screen. When an IDE session is open it takes over
 * the note content area (below the note title) so long programs get full
 * width — same takeover pattern as ExcalidrawBoardHost. Sidebar stays visible
 * because this renders inside SidebarInset, never as a fullscreen modal.
 */
export function CodeIdeHost({ noteTitle }: { noteTitle: string }) {
  const ide = useCodeIDE();
  if (!ide) return null;
  return <CodeIde key={ide.id} request={ide} noteTitle={noteTitle} />;
}

function CodeIde({
  request,
  noteTitle,
}: {
  request: CodeIdeRequest;
  noteTitle: string;
}) {
  const [code, setCode] = React.useState(request.code);
  const [language, setLanguage] = React.useState(() =>
    normalizeCodeLanguage(request.language)
  );
  const [stdin, setStdin] = React.useState("");
  const [panelTab, setPanelTab] = React.useState<"console" | "input">(
    "console"
  );
  const [pending, setPending] = React.useState(false);
  const [running, setRunning] = React.useState(false);
  const [output, setOutput] = React.useState<RunOutput | null>(
    request.initialOutput ?? null
  );
  const [copied, setCopied] = React.useState(false);
  const copiedTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resizable split: fraction of the body given to the output panel.
  // null = CSS default (22rem side column / 40% stacked).
  const [split, setSplit] = React.useState<number | null>(loadSplit);
  const [dragging, setDragging] = React.useState(false);
  // Row (side-by-side) on desktop, column (stacked) below lg — mirrors CSS.
  const [isRow, setIsRow] = React.useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(min-width: 1024px)").matches
  );
  const bodyRef = React.useRef<HTMLDivElement | null>(null);
  const dragLast = React.useRef<number | null>(null);

  React.useEffect(() => {
    return () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    };
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = (e: MediaQueryListEvent) => setIsRow(e.matches);
    try {
      mq.addEventListener("change", onChange);
    } catch {
      // Very old browsers without addEventListener on MediaQueryList.
      try {
        mq.addListener(onChange);
      } catch {}
    }
    return () => {
      try {
        mq.removeEventListener("change", onChange);
      } catch {
        try {
          mq.removeListener(onChange);
        } catch {}
      }
    };
  }, []);

  const latestRef = React.useRef<{ code: string; language: string } | null>(
    null
  );
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSaveRef = React.useRef(request.onSave);
  const onOutputRef = React.useRef(request.onOutput);
  const gutterRef = React.useRef<HTMLDivElement | null>(null);
  const areaRef = React.useRef<HTMLTextAreaElement | null>(null);

  React.useEffect(() => {
    onSaveRef.current = request.onSave;
    onOutputRef.current = request.onOutput;
  }, [request]);

  // Autofocus the editor on open (board blurs TipTap first).
  React.useEffect(() => {
    const t = setTimeout(() => {
      try {
        areaRef.current?.focus({ preventScroll: true });
      } catch {
        try {
          areaRef.current?.focus();
        } catch {}
      }
    }, 60);
    return () => clearTimeout(t);
  }, []);

  const flush = React.useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (latestRef.current) {
      try {
        onSaveRef.current(
          latestRef.current.code,
          latestRef.current.language
        );
      } catch {
        // saving must never break closing the IDE
      }
      latestRef.current = null;
    }
    setPending(false);
  }, []);

  // Safety net: flush pending edits if the IDE unmounts for any reason
  // (navigation, opening another block) before an explicit close.
  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (latestRef.current) {
        try {
          onSaveRef.current(
            latestRef.current.code,
            latestRef.current.language
          );
        } catch {}
        latestRef.current = null;
      }
    };
  }, []);

  const scheduleSave = React.useCallback(
    (nextCode: string, nextLanguage: string) => {
      latestRef.current = { code: nextCode, language: nextLanguage };
      setPending(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        if (latestRef.current) {
          try {
            onSaveRef.current(
              latestRef.current.code,
              latestRef.current.language
            );
          } catch {}
          // keep latestRef so close-flush still has it; cheap + idempotent
        }
        setPending(false);
      }, SAVE_DEBOUNCE_MS);
    },
    []
  );

  const handleClose = React.useCallback(() => {
    flush();
    closeCodeIDE();
  }, [flush]);

  // Escape backs out of the IDE.
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) {
        e.preventDefault();
        handleClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleClose]);

  const lineCount = React.useMemo(
    () => code.split("\n").length,
    [code]
  );
  const lineNumbers = React.useMemo(
    () =>
      Array.from({ length: Math.max(lineCount, 1) }, (_, i) => i + 1).join(
        "\n"
      ),
    [lineCount]
  );

  const handleScroll = React.useCallback(() => {
    const area = areaRef.current;
    const gutter = gutterRef.current;
    if (area && gutter) {
      gutter.scrollTop = area.scrollTop;
    }
  }, []);

  const handleCodeChange = React.useCallback(
    (next: string) => {
      setCode(next);
      scheduleSave(next, language);
    },
    [language, scheduleSave]
  );

  const handleLanguageChange = React.useCallback(
    (next: string) => {
      const normalized = normalizeCodeLanguage(next);
      // Same rule as the inline picker: a previous run belongs to the
      // previous runner kind — clear it so a stale error pill can't linger
      // next to output of a different kind (e.g. an HTML preview).
      if (runnerFor(normalized) !== runnerFor(language)) {
        setOutput(null);
        try {
          onOutputRef.current?.(null);
        } catch {}
      }
      setLanguage(normalized);
      scheduleSave(code, normalized);
    },
    [code, language, scheduleSave]
  );

  // Tab inserts two spaces instead of leaving the editor.
  const handleAreaKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Tab") {
        e.preventDefault();
        const el = e.currentTarget;
        const start = el.selectionStart ?? el.value.length;
        const end = el.selectionEnd ?? el.value.length;
        const next =
          el.value.slice(0, start) + "  " + el.value.slice(end);
        handleCodeChange(next);
        requestAnimationFrame(() => {
          try {
            el.selectionStart = el.selectionEnd = start + 2;
          } catch {}
        });
      }
    },
    [handleCodeChange]
  );

  const clampSplit = React.useCallback((v: number) => {
    if (!Number.isFinite(v)) return null;
    return Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, v));
  }, []);

  const splitFromPointer = React.useCallback(
    (clientX: number, clientY: number): number | null => {
      const el = bodyRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      const raw = isRow
        ? (rect.right - clientX) / rect.width
        : (rect.bottom - clientY) / rect.height;
      return clampSplit(raw);
    },
    [clampSplit, isRow]
  );

  const persistSplit = React.useCallback((v: number | null) => {
    try {
      if (v === null) window.localStorage.removeItem(SPLIT_KEY);
      else window.localStorage.setItem(SPLIT_KEY, String(v));
    } catch {}
  }, []);

  const handleDividerPointerDown = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}
      dragLast.current = split;
      setDragging(true);
    },
    [split]
  );

  const handleDividerPointerMove = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!e.buttons) return;
      const next = splitFromPointer(e.clientX, e.clientY);
      if (next !== null) {
        dragLast.current = next;
        setSplit(next);
      }
    },
    [splitFromPointer]
  );

  const endDividerDrag = React.useCallback(() => {
    setDragging(false);
    persistSplit(dragLast.current);
    dragLast.current = null;
  }, [persistSplit]);

  const resetSplit = React.useCallback(() => {
    dragLast.current = null;
    setSplit(null);
    persistSplit(null);
  }, [persistSplit]);

  const handleDividerKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      // Row mode: Left/Right resize; column mode: Up/Down resize.
      const horizontal = e.key === "ArrowLeft" || e.key === "ArrowRight";
      const vertical = e.key === "ArrowUp" || e.key === "ArrowDown";
      if (isRow && !horizontal) return;
      if (!isRow && !vertical) return;
      const dir = e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 1;
      e.preventDefault();
      const next = clampSplit((split ?? 0.35) + dir * 0.03);
      if (next !== null) {
        setSplit(next);
        persistSplit(next);
      }
    },
    [clampSplit, isRow, persistSplit, split]
  );

  const kind = runnerFor(language);
  const pistonLang = pistonLanguageFor(language);
  const runnable =
    kind === "js" ||
    kind === "python" ||
    kind === "cpp" ||
    kind === "php" ||
    kind === "remote";
  const isPreview = kind === "preview";
  const previewSrcDoc = isPreview
    ? buildPreviewSrcDoc(
        language,
        code,
        language === "html" ? (request.siblingCss ?? null) : null
      )
    : null;
  const previewMergedCss =
    isPreview && language === "html"
      ? (request.siblingCss ?? null)
      : null;
  // stdin only matters for programs that read it; v1 supports it for
  // js (harmless), python, c++ subset, php, and remote runs.
  const stdinVisible =
    kind === "js" ||
    kind === "python" ||
    kind === "cpp" ||
    kind === "php" ||
    kind === "remote";

  const runTitle = runnerTitle(kind, language);
  const consoleRef = React.useRef<HTMLDivElement | null>(null);

  // Keep the newest console output in view.
  React.useEffect(() => {
    const el = consoleRef.current;
    if (el) {
      try {
        el.scrollTop = el.scrollHeight;
      } catch {}
    }
  }, [output]);

  type RunStatus =
    | { state: "idle" }
    | { state: "running" }
    | { state: "ok"; label: string }
    | { state: "error"; label: string };

  const runStatus: RunStatus = running
    ? { state: "running" }
    : output === null
      ? { state: "idle" }
      : (() => {
          const ms = `${output.result.durationMs}ms`;
          switch (output.kind) {
            case "js":
              return output.result.error
                ? { state: "error", label: `error · ${ms}` }
                : { state: "ok", label: `browser · ${ms}` };
            case "python":
              return output.result.error
                ? { state: "error", label: `error · ${ms}` }
                : { state: "ok", label: `pyodide · ${ms}` };
            case "cpp": {
              const exit =
                output.result.exitCode !== null
                  ? ` · exit ${output.result.exitCode}`
                  : "";
              return output.result.error
                ? { state: "error", label: `error${exit} · ${ms}` }
                : { state: "ok", label: `c++ subset${exit} · ${ms}` };
            }
            case "php": {
              const exit =
                output.result.exitCode !== null
                  ? ` · exit ${output.result.exitCode}`
                  : "";
              return output.result.error
                ? { state: "error", label: `error${exit} · ${ms}` }
                : { state: "ok", label: `php-wasm${exit} · ${ms}` };
            }
            case "piston": {
              const compileFailed =
                output.result.compile !== null &&
                typeof output.result.compile.code === "number" &&
                output.result.compile.code !== 0;
              const exit =
                output.result.exitCode !== null
                  ? ` · exit ${output.result.exitCode}`
                  : "";
              return output.result.error || compileFailed
                ? { state: "error", label: `error${exit} · ${ms}` }
                : { state: "ok", label: `piston${exit} · ${ms}` };
            }
          }
        })();

  async function handleCopyOutput() {
    if (!output) return;
    const text = consoleText(output);
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {}
    }
    setCopied(true);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 1400);
  }

  function handleClearOutput() {
    setOutput(null);
    try {
      onOutputRef.current?.(null);
    } catch {}
  }

  async function handleRun() {
    if (running || !runnable || !code.trim()) return;
    setRunning(true);
    setPanelTab("console");
    try {
      let next: RunOutput | null = null;
      if (kind === "js") {
        const result = await runJavaScript(code);
        next = { kind: "js", result };
      } else if (kind === "python") {
        const result = await runPython(code, { stdin });
        next = { kind: "python", result };
      } else if (kind === "cpp") {
        const result = await runCpp(code, { stdin });
        next = { kind: "cpp", result };
      } else if (kind === "php") {
        const result = await runPhp(code, { stdin });
        next = { kind: "php", result };
      } else if (kind === "remote" && pistonLang) {
        const result = await runViaPiston(pistonLang, code, { stdin });
        next = { kind: "piston", result };
      }
      if (next) {
        setOutput(next);
        try {
          onOutputRef.current?.(next);
        } catch {}
      }
    } finally {
      setRunning(false);
    }
  }

  const pickerValue = languageForPicker(language);

  return (
    <div
      className={["code-ide-board", dragging ? "code-ide-dragging" : ""].join(
        " "
      )}
      data-code-ide=""
    >
      <div className="code-ide-header">
        <div className="code-ide-header-left">
          <button
            type="button"
            className="excalidraw-expand-btn excalidraw-board-back"
            title="Back to note"
            aria-label="Back to note"
            onClick={handleClose}
          >
            <ArrowLeftIcon className="size-4 shrink-0" />
            <span className="excalidraw-board-back-label">
              {noteTitle.trim() || "Back to note"}
            </span>
          </button>
          <span className="excalidraw-card-title">
            <Code2Icon className="size-4" />
            Code
            <span className="excalidraw-card-count">
              {pending ? "Saving…" : "Saved"}
            </span>
          </span>
        </div>
        {isPreview ? null : (
          <div className="code-ide-header-center">
            <Select value={pickerValue} onValueChange={handleLanguageChange}>
              <SelectTrigger
                size="sm"
                className="code-ide-lang"
                aria-label="Code language"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" align="start" className="max-h-64">
                {groupedLanguageOptions().map((g) => (
                  <SelectGroup key={g.label}>
                    <SelectLabel>{g.label}</SelectLabel>
                    {g.options.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
            <button
              type="button"
              className="code-block-btn code-block-run"
              title={runTitle}
              aria-label="Run code"
              disabled={!runnable || running || !code.trim()}
              onClick={() => void handleRun()}
            >
              {running ? (
                <Loader2Icon className="size-3.5 animate-spin" />
              ) : (
                <PlayIcon className="size-3.5" />
              )}
              <span className="hidden sm:inline">
                {running ? "Running…" : "Run"}
              </span>
            </button>
          </div>
        )}
        <div className="code-ide-header-right">
          <button
            type="button"
            className="excalidraw-board-done"
            title="Save and back to note"
            aria-label="Save and back to note"
            onClick={handleClose}
          >
            <CheckIcon className="size-4" />
            <span>Done</span>
          </button>
        </div>
      </div>
      <div ref={bodyRef} className="code-ide-body">
        <div className="code-ide-editor-col">
          <div className="code-ide-editor">
            <div
              ref={gutterRef}
              className="code-ide-gutter"
              aria-hidden="true"
            >
              {lineNumbers}
            </div>
            <textarea
              ref={areaRef}
              className="code-ide-area"
              value={code}
              onChange={(e) => handleCodeChange(e.target.value)}
              onScroll={handleScroll}
              onKeyDown={handleAreaKeyDown}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              wrap="off"
              aria-label={`Code editor (${pickerValue}), ${lineCount} lines`}
              placeholder="Write code…"
            />
          </div>
          <div className="code-ide-statusbar" aria-hidden="true">
            <span>{languageLabel(language)}</span>
            <span>
              Ln {lineCount} · {code.length} chars
            </span>
          </div>
        </div>
        <div
          className="code-ide-divider"
          role="separator"
          aria-orientation={isRow ? "vertical" : "horizontal"}
          aria-label="Resize editor and output panels. Double-click to reset."
          aria-valuemin={Math.round(SPLIT_MIN * 100)}
          aria-valuemax={Math.round(SPLIT_MAX * 100)}
          aria-valuenow={
            split === null ? undefined : Math.round(split * 100)
          }
          tabIndex={0}
          data-dragging={dragging ? "true" : "false"}
          onPointerDown={handleDividerPointerDown}
          onPointerMove={handleDividerPointerMove}
          onPointerUp={endDividerDrag}
          onPointerCancel={endDividerDrag}
          onDoubleClick={resetSplit}
          onKeyDown={handleDividerKeyDown}
        />
        <div
          className="code-ide-output"
          style={
            split === null
              ? undefined
              : isRow
                ? {
                    width: `${split * 100}%`,
                    flexBasis: "auto",
                    minWidth: 0,
                  }
                : { height: `${split * 100}%`, maxHeight: "none" }
          }
        >
          <div className="code-ide-output-header">
            {isPreview ? (
              <span className="code-ide-panel-title">
                <TerminalIcon className="size-3.5" />
                Preview
                <span className="code-ide-meta">
                  sandboxed · live
                  {previewMergedCss ? " · + CSS from next block" : ""}
                </span>
              </span>
            ) : (
              <div
                className="code-ide-tabs"
                role="tablist"
                aria-label="Output panel"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={panelTab === "console"}
                  className="code-ide-tab"
                  onClick={() => setPanelTab("console")}
                >
                  <TerminalIcon className="size-3.5" />
                  Console
                </button>
                {stdinVisible ? (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={panelTab === "input"}
                    className="code-ide-tab"
                    onClick={() => setPanelTab("input")}
                  >
                    <KeyboardIcon className="size-3.5" />
                    Input
                    {stdin ? (
                      <span
                        className="code-ide-tab-dot"
                        aria-label="stdin provided"
                      />
                    ) : null}
                  </button>
                ) : null}
              </div>
            )}
            <span className="code-ide-output-actions">
              {runStatus.state === "ok" ? (
                <span className="code-ide-pill code-ide-pill-ok">
                  <span className="code-ide-pill-dot" />
                  {runStatus.label}
                </span>
              ) : runStatus.state === "error" ? (
                <span className="code-ide-pill code-ide-pill-error">
                  <span className="code-ide-pill-dot" />
                  {runStatus.label}
                </span>
              ) : runStatus.state === "running" ? (
                <span className="code-ide-pill code-ide-pill-running">
                  <Loader2Icon className="size-3 animate-spin" />
                  Running…
                </span>
              ) : null}
              {!isPreview && panelTab === "console" && output ? (
                <>
                  <button
                    type="button"
                    className="code-ide-icon-btn"
                    title={copied ? "Copied" : "Copy output"}
                    aria-label="Copy output"
                    onClick={() => void handleCopyOutput()}
                  >
                    {copied ? (
                      <CheckIcon className="size-3.5" />
                    ) : (
                      <CopyIcon className="size-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    className="code-ide-icon-btn"
                    title="Clear output"
                    aria-label="Clear output"
                    onClick={handleClearOutput}
                  >
                    <XIcon className="size-3.5" />
                  </button>
                </>
              ) : null}
            </span>
          </div>
          {isPreview && previewSrcDoc !== null ? (
            <iframe
              sandbox="allow-scripts"
              srcDoc={previewSrcDoc}
              title={`Preview (${pickerValue})`}
              className="code-ide-preview-frame"
            />
          ) : panelTab === "input" && stdinVisible ? (
            <label className="code-ide-stdin-tab">
              <span className="code-ide-stdin-label">
                Program input — one line per row, fed to input() / cin /
                Scanner / php://stdin on the next run
              </span>
              <textarea
                className="code-ide-stdin-area code-ide-stdin-area-fill"
                value={stdin}
                onChange={(e) => setStdin(e.target.value)}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                placeholder="Optional program input…"
                aria-label="Program stdin"
              />
            </label>
          ) : kind === "none" ? (
            <pre className="code-block-output-pre code-block-output-empty">
              {runTitle}
            </pre>
          ) : (
            <div ref={consoleRef} className="code-ide-console">
              <IdeOutputBody output={output} running={running} />
            </div>
          )}
          {pickerValue === "java" && kind === "remote" ? (
            <div className="code-ide-hint">
              Remote Java: use <code>public class Main</code> to match the
              runner entrypoint.
            </div>
          ) : null}
          {previewMergedCss ? (
            <div className="code-ide-hint">
              Styles merged from the CSS block directly below this one — edit
              them there.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function IdeOutputBody({
  output,
  running,
}: {
  output: RunOutput | null;
  running: boolean;
}) {
  if (!output) {
    return (
      <div className="code-ide-empty">
        {running ? (
          <Loader2Icon className="size-5 animate-spin" />
        ) : (
          <TerminalIcon className="size-5" />
        )}
        <p>{running ? "Running…" : "No output yet"}</p>
        <p className="code-ide-empty-hint">
          {running
            ? "Executing your code…"
            : "Press Run to execute — output, errors and exit codes appear here."}
        </p>
      </div>
    );
  }
  if (output.kind === "js") {
    const { result } = output;
    const hasLogs = result.logs.length > 0;
    if (!hasLogs && !result.resultText && !result.error) {
      return (
        <pre className="code-block-output-pre code-block-output-empty">
          No output.
        </pre>
      );
    }
    return (
      <pre className="code-block-output-pre">
        {result.logs.map((l, i) => (
          <div
            key={i}
            className={
              l.type === "error"
                ? "code-block-log-error"
                : l.type === "warn"
                  ? "code-block-log-warn"
                  : undefined
            }
          >
            {l.text}
            {"\n"}
          </div>
        ))}
        {result.resultText !== null && result.resultText !== "" ? (
          <div className="code-block-log-result">{result.resultText}</div>
        ) : null}
        {result.error ? (
          <div className="code-block-log-error">{result.error}</div>
        ) : null}
      </pre>
    );
  }
  if (output.kind === "python") {
    const { result } = output;
    if (!result.output && !result.resultText && !result.error) {
      return (
        <pre className="code-block-output-pre code-block-output-empty">
          No output.
        </pre>
      );
    }
    return (
      <pre className="code-block-output-pre">
        {result.output ? <div>{result.output}</div> : null}
        {result.resultText !== null && result.resultText !== "" ? (
          <div className="code-block-log-result">{result.resultText}</div>
        ) : null}
        {result.error ? (
          <div className="code-block-log-error">{result.error}</div>
        ) : null}
      </pre>
    );
  }
  if (output.kind === "cpp" || output.kind === "php") {
    const { result } = output;
    if (!result.output && !result.error) {
      return (
        <pre className="code-block-output-pre code-block-output-empty">
          No output.
        </pre>
      );
    }
    return (
      <pre className="code-block-output-pre">
        {result.output ? <div>{result.output}</div> : null}
        {result.error ? (
          <div className="code-block-log-error">{result.error}</div>
        ) : null}
      </pre>
    );
  }
  const { result } = output;
  const compileFailed =
    result.compile !== null &&
    typeof result.compile.code === "number" &&
    result.compile.code !== 0;
  const text =
    result.output || [result.stdout, result.stderr].filter(Boolean).join("\n");
  if (!text && !result.error && !compileFailed) {
    return (
      <pre className="code-block-output-pre code-block-output-empty">
        No output.
      </pre>
    );
  }
  return (
    <pre className="code-block-output-pre">
      {compileFailed && result.compile ? (
        <div className="code-block-log-error">
          {result.compile.stderr || result.compile.output || "Compilation failed."}
        </div>
      ) : (
        text ? <div>{text}</div> : null
      )}
      {!compileFailed && result.error ? (
        <div className="code-block-log-error">{result.error}</div>
      ) : null}
    </pre>
  );
}
