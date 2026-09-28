"use client";

/**
 * HTML/CSS run as a sandboxed preview — no code execution service involved.
 * Rendered via `<iframe sandbox="allow-scripts" srcDoc={...}>`:
 * - no `allow-same-origin`, so the snippet gets an opaque origin and cannot
 *   touch notes, localStorage, cookies, or the parent page;
 * - `<script>` inside HTML still works (allow-scripts) for small demos.
 */

const CSS_SAMPLE_BODY = `<header class="card">
  <h1>CSS preview</h1>
  <p>Your stylesheet is applied to this sample markup.</p>
  <a href="#">Sample link</a>
  <button>Sample button</button>
</header>
<section class="card">
  <h2>Heading 2</h2>
  <p>Write selectors like <code>body</code>, <code>h1</code>, <code>.card</code>, <code>button</code> to see them take effect here.</p>
</section>`;

function wrapDocument(head: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${head}
</head>
<body>
${body}
</body>
</html>`;
}

/**
 * Build an iframe `srcDoc` for a single code block. Only `html`/`css` are
 * previewable — anything else returns null.
 *
 * `extraCss` merges a companion stylesheet into an HTML preview (used when
 * an `html` block is directly followed by a `css` block, so the two work
 * together instead of the CSS only applying to sample markup).
 */
export function buildPreviewSrcDoc(
  language: unknown,
  code: string,
  extraCss?: string | null
): string | null {
  const v = typeof language === "string" ? language.trim().toLowerCase() : "";
  if (v === "html") {
    if (!extraCss || !extraCss.trim()) return code;
    const style = `<style>\n${extraCss}\n</style>`;
    if (/<\/head\s*>/i.test(code)) {
      return code.replace(/<\/head\s*>/i, `${style}\n</head>`);
    }
    if (/<html[^>]*>/i.test(code)) {
      return code.replace(/<html[^>]*>/i, (m) => `${m}\n${style}`);
    }
    return `${style}\n${code}`;
  }
  if (v === "css") {
    return wrapDocument(`<style>\n${code}\n</style>`, CSS_SAMPLE_BODY);
  }
  return null;
}
