import { createLowlight } from "lowlight";
import bash from "highlight.js/lib/languages/bash";
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import css from "highlight.js/lib/languages/css";
import diff from "highlight.js/lib/languages/diff";
import go from "highlight.js/lib/languages/go";
import http from "highlight.js/lib/languages/http";
import ini from "highlight.js/lib/languages/ini";
import java from "highlight.js/lib/languages/java";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import makefile from "highlight.js/lib/languages/makefile";
import markdown from "highlight.js/lib/languages/markdown";
import php from "highlight.js/lib/languages/php";
import plaintext from "highlight.js/lib/languages/plaintext";
import python from "highlight.js/lib/languages/python";
import rust from "highlight.js/lib/languages/rust";
import shell from "highlight.js/lib/languages/shell";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";

/**
 * Shared lowlight singleton. Import this from the editor and the
 * code-block NodeView so both agree on the registered grammars.
 * (Previously constructed inline in `components/note-editor.tsx`.)
 */
export const lowlight = createLowlight();

const grammars: Record<string, typeof javascript> = {
  js: javascript,
  jsx: javascript,
  javascript,
  ts: typescript,
  tsx: typescript,
  typescript,
  css,
  html: xml,
  svg: xml,
  xml,
  json,
  py: python,
  python,
  bash,
  sh: shell,
  shell,
  sql,
  md: markdown,
  markdown,
  java,
  c,
  cpp,
  "c++": cpp,
  go,
  rs: rust,
  rust,
  php,
  yml: yaml,
  yaml,
  diff,
  ini,
  http,
  makefile,
  text: plaintext,
  plaintext,
};

lowlight.register(grammars);
