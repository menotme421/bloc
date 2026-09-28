"use client";

import * as React from "react";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
} from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import {
  CheckIcon,
  CopyIcon,
  ExpandIcon,
  Loader2Icon,
  PlayIcon,
  TerminalIcon,
  XIcon,
} from "lucide-react";
import {
  LANGUAGE_OPTIONS,
  groupedLanguageOptions,
  languageForPicker,
  normalizeCodeLanguage,
} from "@/lib/code-block-languages";
import { runJavaScript } from "@/lib/code-runner/run-js";
import { runPython } from "@/lib/code-runner/run-python";
import { runCpp } from "@/lib/code-runner/run-cpp";
import { runPhp } from "@/lib/code-runner/run-php";
import { runViaPiston } from "@/lib/code-runner/piston-client";
import {
  getInlinePreview,
  type RunOutput,
} from "@/lib/code-runner/run-output";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildPreviewSrcDoc } from "@/lib/code-runner/preview";
import {
  pistonLanguageFor,
  runnerBadge,
  runnerFor,
  runnerTitle,
} from "@/lib/code-runner/registry";
import { openCodeIDE, useCodeIDE } from "@/components/code-ide-board";

/**
 * Notion-style code block: language picker + copy + run header around the
 * standard CodeBlockLowlight editable area. Highlighting itself still comes
 * from the lowlight ProseMirror plugin (inline `hljs-*` decorations), so
 * this wrapper only adds chrome — no re-highlighting logic here.
 */
export const CustomCodeBlock = CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView);
  },
});

/**
 * Text of the `css` code block directly following this block, or null.
 * Used to merge a stylesheet into an `html` preview. Position-based, so it
 * stays correct as blocks are inserted, deleted, or reordered.
 */
function followingSiblingCss(
  editor: NodeViewProps["editor"],
  getPos: NodeViewProps["getPos"]
): string | null {
  try {
    const pos = getPos();
    if (typeof pos !== "number") return null;
    const $pos = editor.state.doc.resolve(pos);
    const parent = $pos.parent;
    const base = $pos.start();
    // Identify our own index by absolute position, then peek at the next
    // sibling (works at any nesting depth, not just top-level).
    let found = -1;
    parent.forEach((_child, offset, i) => {
      if (base + offset === pos) found = i;
    });
    if (found < 0 || found + 1 >= parent.childCount) return null;
    const next = parent.child(found + 1);
    if (next.type.name !== "codeBlock") return null;
    const lang = next.attrs.language;
    if (normalizeCodeLanguage(lang) !== "css") return null;
    const text = next.textContent ?? "";
    if (!text.trim()) return null;
    return text.slice(0, 50_000);
  } catch {
    return null;
  }
}

function CodeBlockView(props: NodeViewProps) {
  const { node, updateAttributes, editor, selected } = props;
  const isEditable = editor.isEditable;
  const currentLanguage =
    typeof node.attrs.language === "string" && node.attrs.language
      ? node.attrs.language
      : "plaintext";
  const pickerValue = languageForPicker(currentLanguage);

  // Stable identity for this block instance so the IDE host can highlight
  // the card that is currently open (mirrors ExcalidrawView).
  const viewId = React.useId();
  const ide = useCodeIDE();
  const isIdeOpen = ide?.id === viewId;

  const [copied, setCopied] = React.useState(false);
  const [running, setRunning] = React.useState(false);
  const [output, setOutput] = React.useState<RunOutput | null>(null);
  const [outputOpen, setOutputOpen] = React.useState(false);
  const [previewHidden, setPreviewHidden] = React.useState(false);
  const copyTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

  // NOTE: output is intentionally kept across language switches — switching
  // the picker doesn't change the code, so a previous run stays valid.
  // Output clears only via the X button or a new run.

  const kind = runnerFor(currentLanguage);
  const pistonLang = pistonLanguageFor(currentLanguage);
  const runnable =
    kind === "js" ||
    kind === "python" ||
    kind === "cpp" ||
    kind === "php" ||
    kind === "remote";
  const isPreview = kind === "preview";

  // HTML + CSS merge: when an `html` block is directly followed by a `css`
  // block, the stylesheet is injected into the HTML preview so the two work
  // together (otherwise the CSS only ever applies to sample markup).
  // Re-resolved on every doc update so edits in the CSS block stay live.
  const [docTick, setDocTick] = React.useState(0);
  React.useEffect(() => {
    const bump = () => setDocTick((t) => t + 1);
    editor.on("update", bump);
    return () => {
      editor.off("update", bump);
    };
  }, [editor]);
  const mergedCss = React.useMemo(() => {
    if (currentLanguage !== "html") return null;
    return followingSiblingCss(editor, props.getPos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, currentLanguage, docTick, node]);
  const previewSrcDoc = isPreview
    ? buildPreviewSrcDoc(
        currentLanguage,
        node.textContent ?? "",
        currentLanguage === "html" ? mergedCss : null
      )
    : null;

  async function handleCopy() {
    const text = node.textContent ?? "";
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard API unavailable (permissions/HTTP) — textarea fallback.
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
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 1400);
  }

  async function handleRun() {
    if (running || !runnable) return;
    const code = node.textContent ?? "";
    if (!code.trim()) return;
    setRunning(true);
    setOutputOpen(true);
    try {
      if (kind === "js") {
        const result = await runJavaScript(code);
        setOutput({ kind: "js", result });
      } else if (kind === "python") {
        const result = await runPython(code);
        setOutput({ kind: "python", result });
      } else if (kind === "cpp") {
        const result = await runCpp(code);
        setOutput({ kind: "cpp", result });
      } else if (kind === "php") {
        const result = await runPhp(code);
        setOutput({ kind: "php", result });
      } else if (kind === "remote" && pistonLang) {
        const result = await runViaPiston(pistonLang, code);
        setOutput({ kind: "piston", result });
      }
    } finally {
      setRunning(false);
    }
  }

  const runTitle = runnerTitle(kind, currentLanguage);

  const selectNode = React.useCallback(() => {
    const pos = props.getPos();
    if (typeof pos !== "number") return;
    try {
      editor.chain().focus().setNodeSelection(pos).run();
    } catch {}
  }, [editor, props]);

  // Write IDE edits back into this TipTap code block: language via attrs,
  // code via replacing the block's text content in one transaction.
  const handleIdeSave = React.useCallback(
    (nextCode: string, nextLanguage: string) => {
      const normalized = normalizeCodeLanguage(nextLanguage);
      if (normalized !== currentLanguage) {
        updateAttributes({ language: normalized });
      }
      try {
        const pos = props.getPos();
        if (typeof pos !== "number") return;
        const state = editor.state;
        const nodeAt = state.doc.nodeAt(pos);
        if (!nodeAt) return;
        if ((nodeAt.textContent ?? "") === nextCode) return;
        const from = pos + 1;
        const to = pos + nodeAt.nodeSize - 1;
        const tr = state.tr.replaceWith(
          from,
          to,
          state.schema.text(nextCode)
        );
        editor.view.dispatch(tr);
      } catch {}
    },
    [currentLanguage, editor, props, updateAttributes]
  );

  const openIde = React.useCallback(() => {
    selectNode();
    try {
      editor.commands.blur();
    } catch {
      // blur is best-effort (dismiss mobile keyboard; IDE autofocuses)
    }
    openCodeIDE({
      id: viewId,
      language: currentLanguage,
      code: node.textContent ?? "",
      onSave: handleIdeSave,
      // Stylesheet of the directly-following CSS block (HTML only), so the
      // IDE preview matches the merged inline preview.
      siblingCss: currentLanguage === "html" ? mergedCss : null,
      // Session-only share: inline run -> Expand shows the same output, and
      // IDE run/clear syncs back here via onOutput so Back shows it inline.
      initialOutput: output,
      onOutput: (next) => {
        setOutput(next);
        setOutputOpen(next !== null);
      },
    });
  }, [
    currentLanguage,
    editor,
    handleIdeSave,
    mergedCss,
    node,
    output,
    selectNode,
    viewId,
  ]);

  return (
    <NodeViewWrapper
      as="div"
      className={[
        "code-block-wrap",
        selected ? "code-block-selected" : "",
        isIdeOpen ? "code-block-ide-open" : "",
      ].join(" ")}
      data-code-block=""
      data-language={currentLanguage}
    >
      {/* Header is chrome — never part of the editable code. */}
      <div
        className="code-block-header"
        contentEditable={false}
        suppressContentEditableWarning
        onMouseDown={(e) => e.stopPropagation()}
      >
        {isEditable ? (
          <Select
            value={pickerValue}
            onValueChange={(next) => {
              // A previous run belongs to the previous runner: keep it only
              // when the runner kind is unchanged (e.g. JavaScript ->
              // TypeScript), otherwise a stale error pill would linger next
              // to output of a different kind (e.g. an HTML preview).
              if (
                runnerFor(normalizeCodeLanguage(next)) !==
                runnerFor(currentLanguage)
              ) {
                setOutput(null);
                setOutputOpen(false);
              }
              updateAttributes({ language: next });
              // Keep focus in the editor so typing continues in the block.
              try {
                editor.chain().focus().run();
              } catch {}
            }}
          >
            <SelectTrigger
              size="sm"
              className="code-block-lang-select"
              aria-label="Code block language"
              onMouseDown={(e) => e.stopPropagation()}
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
        ) : (
          <span className="code-block-lang-label">
            {LANGUAGE_OPTIONS.find((o) => o.value === pickerValue)?.label ??
              currentLanguage}
          </span>
        )}
        <span className="code-block-actions">
          <button
            type="button"
            className="code-block-btn"
            title="Expand in full IDE"
            aria-label="Expand in full IDE"
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              openIde();
            }}
          >
            <ExpandIcon className="size-3.5" />
            <span className="hidden sm:inline">Expand</span>
          </button>
          <button
            type="button"
            className="code-block-btn"
            title="Copy code"
            aria-label="Copy code"
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void handleCopy();
            }}
          >
            {copied ? (
              <CheckIcon className="size-3.5" />
            ) : (
              <CopyIcon className="size-3.5" />
            )}
            <span className="hidden sm:inline">
              {copied ? "Copied" : "Copy"}
            </span>
          </button>
          {isPreview ? null : (
            <button
              type="button"
              className="code-block-btn code-block-run"
              title={runTitle}
              aria-label="Run code"
              disabled={!runnable || running || !node.textContent?.trim()}
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void handleRun();
              }}
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
          )}
        </span>
      </div>

      {/* Editable code area. NodeViewContent renders the text (lowlight's
          inline hljs-* decorations land directly on it). The inner div is
          neutralized via CSS so code > div behaves like plain code text. */}
      <pre
        className="code-block-pre"
        data-language={currentLanguage}
        onMouseDown={(e) => e.stopPropagation()}
        spellCheck={false}
      >
        <code
          className={
            currentLanguage && currentLanguage !== "plaintext"
              ? `language-${currentLanguage}`
              : undefined
          }
        >
          <NodeViewContent />
        </code>
      </pre>

      {isPreview && previewSrcDoc !== null ? (
        previewHidden ? (
          <div
            className="code-block-output"
            contentEditable={false}
            suppressContentEditableWarning
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="code-block-output-header">
              <span className="code-block-output-title">
                <TerminalIcon className="size-3.5" />
                Preview
                <span className="code-block-output-meta">hidden</span>
              </span>
              <span className="code-block-output-actions">
                <button
                  type="button"
                  className="code-block-btn"
                  title="Show preview"
                  aria-label="Show preview"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setPreviewHidden(false);
                  }}
                >
                  <ExpandIcon className="size-3.5" />
                  <span className="hidden sm:inline">Show</span>
                </button>
              </span>
            </div>
          </div>
        ) : (
          <div
            className="code-block-output"
            contentEditable={false}
            suppressContentEditableWarning
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="code-block-output-header">
              <span className="code-block-output-title">
                <TerminalIcon className="size-3.5" />
                Preview
                <span className="code-block-output-meta">
                  sandboxed · live
                  {currentLanguage === "html" && mergedCss
                    ? " · + CSS from next block"
                    : ""}
                </span>
              </span>
              <span className="code-block-output-actions">
                <button
                  type="button"
                  className="code-block-btn"
                  title="Expand to full preview"
                  aria-label="Expand to full preview"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    openIde();
                  }}
                >
                  <ExpandIcon className="size-3.5" />
                  <span className="hidden sm:inline">Expand</span>
                </button>
                <button
                  type="button"
                  className="code-block-btn"
                  title="Hide preview"
                  aria-label="Hide preview"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setPreviewHidden(true);
                  }}
                >
                  <XIcon className="size-3.5" />
                </button>
              </span>
            </div>
            <iframe
              sandbox="allow-scripts"
              srcDoc={previewSrcDoc}
              title={`Preview (${currentLanguage})`}
              className="code-block-preview-frame"
            />
          </div>
        )
      ) : null}

      {output && outputOpen ? (
        <div
          className="code-block-output"
          contentEditable={false}
          suppressContentEditableWarning
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="code-block-output-header">
            <span className="code-block-output-title">
              <TerminalIcon className="size-3.5" />
              Output
              <span className="code-block-output-meta">
                {runnerBadge(output.kind)} · {output.result.durationMs}ms
                {output.kind === "piston" && output.result.exitCode !== null
                  ? ` · exit ${output.result.exitCode}`
                  : output.kind === "cpp" && output.result.exitCode !== null
                    ? ` · exit ${output.result.exitCode}`
                    : output.kind === "php" && output.result.exitCode !== null
                      ? ` · exit ${output.result.exitCode}`
                      : ""}
              </span>
            </span>
            <span className="code-block-output-actions">
              <button
                type="button"
                className="code-block-btn"
                title="Expand to see full output"
                aria-label="Expand to see full output"
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  openIde();
                }}
              >
                <ExpandIcon className="size-3.5" />
                <span className="hidden sm:inline">Expand</span>
              </button>
              <button
                type="button"
                className="code-block-btn"
                title="Clear output"
                aria-label="Clear output"
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setOutput(null);
                  setOutputOpen(false);
                }}
              >
                <XIcon className="size-3.5" />
              </button>
            </span>
          </div>
          <InlineRunOutput output={output} onExpand={openIde} />
        </div>
      ) : null}
    </NodeViewWrapper>
  );
}

function InlineRunOutput({
  output,
  onExpand,
}: {
  output: RunOutput;
  onExpand: () => void;
}) {
  const preview = React.useMemo(() => getInlinePreview(output), [output]);
  if (!preview.truncated) {
    return <RunOutputBody output={output} />;
  }
  return (
    <>
      <pre className="code-block-output-pre is-truncated">
        {preview.previewText}
      </pre>
      <div
        className="code-block-output-more"
        contentEditable={false}
        suppressContentEditableWarning
        onMouseDown={(e) => e.stopPropagation()}
      >
        <span>Output too large — expand to see full output.</span>
        <button
          type="button"
          className="code-block-btn code-block-output-more-btn"
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onExpand();
          }}
        >
          <ExpandIcon className="size-3.5" />
          Expand
        </button>
      </div>
    </>
  );
}

function RunOutputBody({ output }: { output: RunOutput }) {
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
    const text = result.output;
    if (!text && !result.resultText && !result.error) {
      return (
        <pre className="code-block-output-pre code-block-output-empty">
          No output.
        </pre>
      );
    }
    return (
      <pre className="code-block-output-pre">
        {text ? <div>{text}</div> : null}
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
