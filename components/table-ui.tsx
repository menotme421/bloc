"use client";

import * as React from "react";
import type { Editor } from "@tiptap/react";
import {
  EllipsisVerticalIcon,
  GripHorizontalIcon,
  GripVerticalIcon,
  MergeIcon,
  MoveDownIcon,
  MoveLeftIcon,
  MoveRightIcon,
  MoveUpIcon,
  PaintBucketIcon,
  PlusIcon,
  SplitIcon,
  Trash2Icon,
} from "lucide-react";
import { TableProperties as ColPropertiesIcon } from "@/components/table-col-properties";
import { TableProperties as RowPropertiesIcon } from "@/components/table-row-properties";

import { Switch } from "@/components/ui/switch";
import { CellSelection } from "@tiptap/pm/tables";

type Rect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

type TableRef = {
  table: import("@tiptap/pm/model").Node;
  start: number;
  rows: number;
  cols: number;
};

const CELL_COLORS = [
  "#d9d1ff",
  "#987cfa",
  "#6640e8",
  "#2563eb",
  "#1a9e5c",
  "#d97706",
  "#d4183d",
  "#e6e6ec",
  "#717182",
];

function tableRefAt(doc: import("@tiptap/pm/model").Node, pos: number): TableRef | null {
  const $pos = doc.resolve(Math.max(0, Math.min(pos, doc.content.size)));
  let table = null as import("@tiptap/pm/model").Node | null;
  let start = 0;
  for (let d = $pos.depth; d > 0; d--) {
    if ($pos.node(d).type.name === "table") {
      table = $pos.node(d);
      start = $pos.start(d);
      break;
    }
  }
  if (!table) return null;
  return {
    table,
    start,
    rows: table.childCount,
    cols: table.firstChild?.childCount ?? 0,
  };
}

function getHoverTable(editor: Editor, hoverPos: number): TableRef | null {
  return tableRefAt(editor.state.doc, hoverPos);
}

function cellContentPos(ref: TableRef, rowIdx: number, colIdx: number): number | null {
  const { table, start } = ref;
  if (rowIdx < 0 || rowIdx >= table.childCount) return null;
  const row = table.child(rowIdx);
  if (colIdx < 0 || colIdx >= row.childCount) return null;
  let pos = start + 1;
  for (let r = 0; r < rowIdx; r++) pos += table.child(r).nodeSize;
  for (let c = 0; c < colIdx; c++) pos += row.child(c).nodeSize;
  return pos + 2;
}

function cellPos(ref: TableRef, rowIdx: number, colIdx: number): number | null {
  const { table, start } = ref;
  if (rowIdx < 0 || rowIdx >= table.childCount) return null;
  const row = table.child(rowIdx);
  if (colIdx < 0 || colIdx >= row.childCount) return null;
  let pos = start;
  for (let r = 0; r < rowIdx; r++) pos += table.child(r).nodeSize;
  for (let c = 0; c < colIdx; c++) pos += row.child(c).nodeSize;
  return pos + 1;
}

function lastCellContentPos(ref: TableRef): number | null {
  const { table } = ref;
  for (let r = table.childCount - 1; r >= 0; r--) {
    const row = table.child(r);
    if (row.childCount === 0) continue;
    return cellContentPos(ref, r, row.childCount - 1);
  }
  return null;
}

function selectRowCells(editor: Editor, ref: TableRef, row: number): void {
  const anchor = cellPos(ref, row, 0);
  const head = cellPos(ref, row, ref.cols - 1);
  if (anchor === null || head === null) return;
  editor
    .chain()
    .focus()
    .command(({ tr }) => {
      tr.setSelection(
        new CellSelection(tr.doc.resolve(anchor), tr.doc.resolve(head))
      );
      return true;
    })
    .run();
}

function selectColumnCells(editor: Editor, ref: TableRef, col: number): void {
  const anchor = cellPos(ref, 0, col);
  const head = cellPos(ref, ref.rows - 1, col);
  if (anchor === null || head === null) return;
  editor
    .chain()
    .focus()
    .command(({ tr }) => {
      tr.setSelection(
        new CellSelection(tr.doc.resolve(anchor), tr.doc.resolve(head))
      );
      return true;
    })
    .run();
}

function getHeaderState(ref: TableRef): { row: boolean; col: boolean } {
  const { table } = ref;
  let row = true;
  const firstRow = table.firstChild;
  if (firstRow) {
    firstRow.forEach((cell) => {
      if (cell.type.name !== "tableHeader") row = false;
    });
  } else {
    row = false;
  }
  let col = true;
  table.forEach((rowNode) => {
    if (rowNode.firstChild?.type.name !== "tableHeader") col = false;
  });
  return { row, col };
}

function hasMergedCells(ref: TableRef): boolean {
  let merged = false;
  ref.table.forEach((rowNode) => {
    rowNode.forEach((cell) => {
      if (cell.attrs.colspan > 1 || cell.attrs.rowspan > 1) merged = true;
    });
  });
  return merged;
}

function hasRowspanCells(ref: TableRef): boolean {
  let spans = false;
  ref.table.forEach((rowNode) => {
    rowNode.forEach((cell) => {
      if (cell.attrs.rowspan > 1) spans = true;
    });
  });
  return spans;
}

function selectRowInTr(
  tr: import("@tiptap/pm/state").Transaction,
  ref: TableRef,
  row: number
): void {
  const anchor = cellPos(ref, row, 0);
  const head = cellPos(ref, row, ref.cols - 1);
  if (anchor === null || head === null) return;
  tr.setSelection(
    new CellSelection(tr.doc.resolve(anchor), tr.doc.resolve(head))
  );
}

function selectColInTr(
  tr: import("@tiptap/pm/state").Transaction,
  ref: TableRef,
  col: number
): void {
  const anchor = cellPos(ref, 0, col);
  const head = cellPos(ref, ref.rows - 1, col);
  if (anchor === null || head === null) return;
  tr.setSelection(
    new CellSelection(tr.doc.resolve(anchor), tr.doc.resolve(head))
  );
}

function moveRowTo(editor: Editor, anchorPos: number, from: number, to: number): void {
  if (from === to || !editor) return;
  const ref = getHoverTable(editor, anchorPos);
  if (!ref) return;
  if (from < 0 || from >= ref.rows || to < 0 || to >= ref.rows) return;
  const { table, start } = ref;
  const rowNode = table.child(from);
  const size = rowNode.nodeSize;
  let fromPos = start;
  for (let r = 0; r < from; r++) fromPos += table.child(r).nodeSize;
  let targetPos = start;
  for (let r = 0; r < to; r++) targetPos += table.child(r).nodeSize;
  editor
    .chain()
    .focus()
    .command(({ tr }) => {
      tr.delete(fromPos, fromPos + size);
      tr.insert(to > from ? targetPos - size : targetPos, rowNode);
      const moved = tableRefAt(tr.doc, anchorPos);
      if (moved) selectRowInTr(tr, moved, to);
      return true;
    })
    .run();
}

function moveColumnTo(editor: Editor, anchorPos: number, from: number, to: number): void {
  if (from === to || !editor) return;
  const ref = getHoverTable(editor, anchorPos);
  if (!ref) return;
  if (from < 0 || from >= ref.cols || to < 0 || to >= ref.cols) return;
  editor
    .chain()
    .focus()
    .command(({ tr }) => {
      for (let r = ref.rows - 1; r >= 0; r--) {
        const row = ref.table.child(r);
        const cell = row.child(from);
        const fromPos = cellPos(ref, r, from);
        const toPos = cellPos(ref, r, to);
        if (fromPos === null || toPos === null) continue;
        const size = cell.nodeSize;
        tr.delete(fromPos, fromPos + size);
        tr.insert(to > from ? toPos - size : toPos, cell);
      }
      const moved = tableRefAt(tr.doc, anchorPos);
      if (moved) selectColInTr(tr, moved, to);
      return true;
    })
    .run();
}

function relRect(container: HTMLElement, el: Element): Rect {
  const c = container.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  return {
    left: r.left - c.left,
    top: r.top - c.top,
    right: r.right - c.left,
    bottom: r.bottom - c.top,
    width: r.width,
    height: r.height,
  };
}

function unionRect(container: HTMLElement, els: Element[]): Rect {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const el of els) {
    const r = relRect(container, el);
    left = Math.min(left, r.left);
    top = Math.min(top, r.top);
    right = Math.max(right, r.right);
    bottom = Math.max(bottom, r.bottom);
  }
  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
  };
}

function clampFrameToBox(rect: Rect, box: Rect): Rect | null {
  const left = Math.max(box.left, Math.min(rect.left, box.right - 2));
  const top = Math.max(box.top, Math.min(rect.top, box.bottom - 2));
  const right = Math.min(box.right - 1, Math.max(rect.right, left + 2));
  const bottom = Math.min(box.bottom - 1, Math.max(rect.bottom, top + 2));
  if (right - left >= 1 && bottom - top >= 1) {
    return {
      left,
      top,
      right,
      bottom,
      width: right - left,
      height: bottom - top,
    };
  }
  return null;
}

function selectionBounds(container: HTMLElement, wrapper: Element | null): Rect {
  if (wrapper) return relRect(container, wrapper);
  return {
    left: 0,
    top: 0,
    right: container.clientWidth,
    bottom: container.clientHeight,
    width: container.clientWidth,
    height: container.clientHeight,
  };
}

export function TableUI({
  editor,
  containerRef,
  tableAnchorRef,
}: {
  editor: Editor | null;
  containerRef: React.RefObject<HTMLDivElement | null>;
  tableAnchorRef: React.RefObject<{ pos: number } | null>;
}) {
  const [hovered, setHovered] = React.useState<HTMLElement | null>(null);
  const [tableRect, setTableRect] = React.useState<Rect | null>(null);
  const [wrapperRect, setWrapperRect] = React.useState<Rect | null>(null);
  const [edgeAction, setEdgeAction] = React.useState({
    mergeable: false,
    splittable: false,
  });
  const [edgeMenu, setEdgeMenu] = React.useState<{
    left: number;
    top: number;
  } | null>(null);
  const [edgeHovered, setEdgeHovered] = React.useState(false);
  const [colorOpen, setColorOpen] = React.useState(false);
  const [rowHandle, setRowHandle] = React.useState<{
    row: number;
    x: number;
    y: number;
  } | null>(null);
  const [colHandle, setColHandle] = React.useState<{
    col: number;
    x: number;
    y: number;
  } | null>(null);
  const [rowIndicator, setRowIndicator] = React.useState<{
    row: number;
    x: number;
    y: number;
    h: number;
  } | null>(null);
  const [colIndicator, setColIndicator] = React.useState<{
    col: number;
    x: number;
    y: number;
    w: number;
  } | null>(null);
  const [rowMenu, setRowMenu] = React.useState<{
    left: number;
    top: number;
    row: number;
  } | null>(null);
  const [colMenu, setColMenu] = React.useState<{
    left: number;
    top: number;
    col: number;
  } | null>(null);
  const [headerState, setHeaderState] = React.useState({
    row: false,
    col: false,
  });
  const [corner, setCorner] = React.useState<{
    rows: number;
    cols: number;
  } | null>(null);
  const [edgeHit, setEdgeHit] = React.useState(false);
  const [selFrame, setSelFrame] = React.useState<Rect | null>(null);
  const tableRectRef = React.useRef<Rect | null>(null);

  const rowMenuRef = React.useRef<{ open: boolean; row: number }>({
    open: false,
    row: 0,
  });
  const colMenuRef = React.useRef<{ open: boolean; col: number }>({
    open: false,
    col: 0,
  });
  const edgeMenuRef = React.useRef<{ open: boolean }>({ open: false });
  const lastToggleRef = React.useRef<{ action: string; at: number }>({
    action: "",
    at: 0,
  });
  const cornerDragRef = React.useRef<{
    startX: number;
    startY: number;
    startRows: number;
    startCols: number;
    rowH: number;
    colW: number;
    lastRows: number;
    lastCols: number;
  } | null>(null);
  const [dragState, setDragState] = React.useState<{
    kind: "row" | "col";
    from: number;
    source: Rect;
  } | null>(null);
  const [dropIndicator, setDropIndicator] = React.useState<{
    vertical: boolean;
    pos: number;
    cross: number;
    length: number;
  } | null>(null);
  const dragRef = React.useRef<{
    kind: "row" | "col";
    from: number;
    dragging: boolean;
  } | null>(null);
  const suppressClickRef = React.useRef(false);

  const refreshTableRect = React.useCallback(() => {
    const container = containerRef.current;
    if (!container || !hovered) {
      setTableRect(null);
      tableRectRef.current = null;
      setWrapperRect(null);
      return;
    }
    const rect = relRect(container, hovered);
    setTableRect(rect);
    tableRectRef.current = rect;
    const wrapper = hovered.parentElement;
    setWrapperRect(wrapper ? relRect(container, wrapper) : null);
  }, [containerRef, hovered]);

  React.useEffect(() => {
    refreshTableRect();
  }, [hovered, refreshTableRect]);

  const EDGE_PAD = 16;

  React.useLayoutEffect(() => {
    const measure = (container: HTMLElement) => {
      const gapEl = document.querySelector<HTMLElement>(
        '[data-slot="sidebar-gap"]'
      );
      const gap = gapEl ? gapEl.offsetWidth : 0;
      const viewportWidth = document.documentElement.clientWidth;
      const rect = container.getBoundingClientRect();
      const center = rect.left + rect.width / 2;
      const half = Math.min(
        center - gap - EDGE_PAD,
        viewportWidth - EDGE_PAD - center
      );
      container.style.setProperty(
        "--table-max-width",
        `${Math.max(0, half) * 2}px`
      );
      const table = container.querySelector("table");
      container.style.setProperty(
        "--table-natural-w",
        table ? `${table.getBoundingClientRect().width}px` : "0px"
      );
    };

    const setup = (container: HTMLElement) => {
      measure(container);
      let settle: number | null = null;
      const refresh = () => {
        measure(container);
        if (settle !== null) window.clearTimeout(settle);
        settle = window.setTimeout(() => measure(container), 300);
      };
      const observer = new ResizeObserver(refresh);
      observer.observe(container);
      const gapEl = document.querySelector('[data-slot="sidebar-gap"]');
      if (gapEl) observer.observe(gapEl);
      observer.observe(document.body);
      const mutations = new MutationObserver(refresh);
      mutations.observe(container, {
        childList: true,
        subtree: true,
        characterData: true,
      });
      window.addEventListener("resize", refresh);
      return () => {
        observer.disconnect();
        mutations.disconnect();
        if (settle !== null) window.clearTimeout(settle);
        window.removeEventListener("resize", refresh);
      };
    };

    const container = containerRef.current;
    if (!container) {
      let attempts = 0;
      let timer: number | null = null;
      let cleanup: (() => void) | null = null;
      const retry = () => {
        const c = containerRef.current;
        if (c) {
          cleanup = setup(c);
          return;
        }
        if (attempts++ < 300) {
          timer = window.setTimeout(retry, 200);
        }
      };
      timer = window.setTimeout(retry, 200);
      return () => {
        if (timer !== null) window.clearTimeout(timer);
        cleanup?.();
      };
    }

    return setup(container);
  }, [containerRef]);

  const toggleHeaderRow = React.useCallback(() => {
    if (!editor) return;
    const a = tableAnchorRef.current;
    const ref = a ? getHoverTable(editor, a.pos) : null;
    const merged = ref ? hasMergedCells(ref) : false;
    const p = ref ? cellContentPos(ref, 0, 0) : null;
    if (!ref || merged) return;
    if (p === null) return;
    editor.chain().focus().setTextSelection(p).toggleHeaderRow().fixTables().run();
    const newRef = a ? getHoverTable(editor, a.pos) : null;
    setHeaderState(newRef ? getHeaderState(newRef) : { row: false, col: false });
  }, [editor, tableAnchorRef]);

  const toggleHeaderCol = React.useCallback(() => {
    if (!editor) return;
    const a = tableAnchorRef.current;
    if (!a) return;
    const ref = getHoverTable(editor, a.pos);
    if (!ref || hasMergedCells(ref)) return;
    const p = cellContentPos(ref, 0, 0);
    if (p === null) return;
    editor.chain().focus().setTextSelection(p).toggleHeaderColumn().fixTables().run();
    const newRef = a ? getHoverTable(editor, a.pos) : null;
    setHeaderState(newRef ? getHeaderState(newRef) : { row: false, col: false });
  }, [editor, tableAnchorRef]);

React.useEffect(() => {
    if (!editor) return;
    const container = containerRef.current;
    if (!container) return;

    const HOVER_BAND_PX = 8;
    const ROW_PILL_LEN = 26;
    const COL_PILL_LEN = 26;

    const clearChrome = () => {
      setRowHandle(null);
      setColHandle(null);
      setRowIndicator(null);
      setColIndicator(null);
      setEdgeHovered(false);
    };

    function growTable(rowsToAdd: number, colsToAdd: number) {
      if (!editor) return;
      const a = tableAnchorRef.current;
      if (!a || (rowsToAdd <= 0 && colsToAdd <= 0)) return;
      for (let i = 0; i < rowsToAdd; i++) {
        const ref = getHoverTable(editor, tableAnchorRef.current?.pos ?? a.pos);
        if (!ref) return;
        const last = lastCellContentPos(ref);
        if (last === null) return;
        editor.chain().focus().setTextSelection(last).addRowAfter().run();
      }
      for (let i = 0; i < colsToAdd; i++) {
        const ref = getHoverTable(editor, tableAnchorRef.current?.pos ?? a.pos);
        if (!ref) return;
        const last = lastCellContentPos(ref);
        if (last === null) return;
        editor.chain().focus().setTextSelection(last).addColumnAfter().run();
      }
    }

    function cornerStart(e: PointerEvent) {
      if (!editor) return;
      if (!hovered || !tableAnchorRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      const rect = hovered.getBoundingClientRect();
      const ref = getHoverTable(editor, tableAnchorRef.current.pos);
      if (!ref) return;
      const startRows = Math.max(ref.rows, 1);
      const startCols = Math.max(ref.cols, 1);
      cornerDragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startRows,
        startCols,
        rowH: Math.max(rect.height / startRows, 1),
        colW: Math.max(rect.width / startCols, 1),
        lastRows: -1,
        lastCols: -1,
      };
      setCorner({ rows: 0, cols: 0 });
      clearChrome();
      const desiredFrom = (ev: PointerEvent) => {
        const drag = cornerDragRef.current;
        if (!drag) return null;
        return {
          rows: Math.max(
            1,
            Math.min(20, Math.round(drag.startRows + (ev.clientY - drag.startY) / drag.rowH))
          ),
          cols: Math.max(
            1,
            Math.min(20, Math.round(drag.startCols + (ev.clientX - drag.startX) / drag.colW))
          ),
        };
      };
      const onMove = (ev: PointerEvent) => {
        const drag = cornerDragRef.current;
        const desired = desiredFrom(ev);
        if (!drag || !desired) return;
        applyCornerSize(desired.rows, desired.cols, drag);
        setCorner({
          rows: desired.rows - drag.startRows,
          cols: desired.cols - drag.startCols,
        });
      };
      const onUp = (ev: PointerEvent) => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        const drag = cornerDragRef.current;
        cornerDragRef.current = null;
        if (drag) {
          const desired = desiredFrom(ev);
          if (desired) applyCornerSize(desired.rows, desired.cols, drag);
        }
        setCorner(null);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    }

    function applyCornerSize(
      desiredRows: number,
      desiredCols: number,
      drag: NonNullable<typeof cornerDragRef.current>
    ) {
      if (!editor) return;
      const a = tableAnchorRef.current;
      if (!a) return;
      const ref = getHoverTable(editor, a.pos);
      if (!ref) return;
      const deltaRows = desiredRows - ref.rows;
      const deltaCols = desiredCols - ref.cols;
      if (desiredRows === drag.lastRows && desiredCols === drag.lastCols) return;

      if (hovered) {
        const r = hovered.getBoundingClientRect();
        const hit = editor.view.posAtCoords({ left: r.left + 4, top: r.top + 4 });
        if (hit) {
          const $pos = editor.state.doc.resolve(hit.pos);
          for (let d = $pos.depth; d > 0; d--) {
            if ($pos.node(d).type.name === "table") {
              tableAnchorRef.current = { pos: $pos.start(d) + 1 };
              break;
            }
          }
        }
      }

      if (deltaRows < 0) {
        let guard = 0;
        while (guard < -deltaRows) {
          guard++;
          const r = getHoverTable(editor, tableAnchorRef.current?.pos ?? a.pos);
          if (!r || r.rows <= 1) break;
          deleteRowAt(r.rows - 1);
        }
      }
      if (deltaCols < 0) {
        let guard = 0;
        while (guard < -deltaCols) {
          guard++;
          const r = getHoverTable(editor, tableAnchorRef.current?.pos ?? a.pos);
          if (!r || r.cols <= 1) break;
          deleteColAt(r.cols - 1);
        }
      }
      growTable(Math.max(0, deltaRows), Math.max(0, deltaCols));
      drag.lastRows = desiredRows;
      drag.lastCols = desiredCols;
    }

    function addRowBeforeAt(row: number) {
      if (!editor) return;
      const a = tableAnchorRef.current;
      if (!a) return;
      const ref = getHoverTable(editor, a.pos);
      if (!ref) return;
      const p = cellContentPos(ref, row, 0);
      if (p === null) return;
      editor.chain().focus().setTextSelection(p).addRowBefore().run();
    }

    function addRowAfterAt(row: number) {
      if (!editor) return;
      const a = tableAnchorRef.current;
      if (!a) return;
      const ref = getHoverTable(editor, a.pos);
      if (!ref) return;
      const p = cellContentPos(ref, row, ref.cols - 1);
      if (p === null) return;
      editor.chain().focus().setTextSelection(p).addRowAfter().run();
    }

    function deleteRowAt(row: number) {
      if (!editor) return;
      const a = tableAnchorRef.current;
      if (!a) return;
      const ref = getHoverTable(editor, a.pos);
      if (!ref) return;
      if (ref.rows <= 1) {
        editor.chain().focus().deleteTable().run();
        setHovered(null);
        return;
      }
      const p = cellContentPos(ref, row, 0);
      if (p === null) return;
      editor.chain().focus().setTextSelection(p).deleteRow().run();
    }

    function deleteColAt(col: number) {
      if (!editor) return;
      const a = tableAnchorRef.current;
      if (!a) return;
      const ref = getHoverTable(editor, a.pos);
      if (!ref) return;
      if (ref.cols <= 1) {
        editor.chain().focus().deleteTable().run();
        setHovered(null);
        return;
      }
      const p = cellContentPos(ref, 0, col);
      if (p === null) return;
      editor.chain().focus().setTextSelection(p).deleteColumn().run();
    }

    function addColBeforeAt(col: number) {
      if (!editor) return;
      const a = tableAnchorRef.current;
      if (!a) return;
      const ref = getHoverTable(editor, a.pos);
      if (!ref) return;
      const p = cellContentPos(ref, 0, col);
      if (p === null) return;
      editor.chain().focus().setTextSelection(p).addColumnBefore().run();
    }

    function addColAfterAt(col: number) {
      if (!editor) return;
      const a = tableAnchorRef.current;
      if (!a) return;
      const ref = getHoverTable(editor, a.pos);
      if (!ref) return;
      const p = cellContentPos(ref, 0, col);
      if (p === null) return;
      editor.chain().focus().setTextSelection(p).addColumnAfter().run();
    }

    const closeMenus = () => {
      setRowMenu(null);
      rowMenuRef.current = { ...rowMenuRef.current, open: false };
      setColMenu(null);
      colMenuRef.current = { ...colMenuRef.current, open: false };
      setEdgeMenu(null);
      edgeMenuRef.current = { open: false };
      setColorOpen(false);
    };

    const onPointerMove = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target || !container.contains(target)) return;
      if (cornerDragRef.current) return;
      if (dragRef.current) return;
      if (target.closest("[data-edge-zone]")) {
        setEdgeHovered(true);
        return;
      }
      if (rowMenuRef.current.open || colMenuRef.current.open) return;
      if (target.closest(".table-edge-track, .table-corner")) {
        setEdgeHit(true);
        setEdgeHovered(false);
        clearChrome();
        return;
      }
      let cell = target.closest<HTMLElement>("td, th");
      if (!cell) {
        const dhEl = target.closest<HTMLElement>(".drag-handle");
        if (dhEl) cell = resolveCellFromDragHandle(e, dhEl);
      }
      if (!cell) {
        if (target.closest("[data-table-chrome]")) {
          setEdgeHovered(false);
        } else {
          clearChrome();
          if (!inTrackZone(e)) setEdgeHit(false);
        }
        return;
      }
      setEdgeHovered(false);
      const tableEl = cell.closest("table");
      if (!tableEl) return;
      const tr = cell.closest("tr");
      if (!tr) return;
      const tbody = tr.parentElement;
      if (!tbody) return;
      const rows = Array.from(tbody.children);
      const rowIdx = rows.indexOf(tr);
      if (rowIdx < 0) return;
      const cells = Array.from(tr.children);
      const colIdx = cells.indexOf(cell);
      if (colIdx < 0) return;
      setEdgeHit(colIdx === cells.length - 1 || rowIdx === rows.length - 1);

      const cRect = cell.getBoundingClientRect();
      const coRect = container.getBoundingClientRect();
      const xIn = e.clientX - cRect.left;
      const yIn = e.clientY - cRect.top;

      if (colIdx === 0) {
        const lineX = cRect.left - coRect.left;
        if (xIn < HOVER_BAND_PX) {
          setRowIndicator(null);
          setRowHandle({
            row: rowIdx,
            x: lineX,
            y: cRect.top - coRect.top + cRect.height / 2,
          });
        } else {
          setRowHandle(null);
          setRowIndicator({
            row: rowIdx,
            x: lineX - 4,
            y: cRect.top - coRect.top + cRect.height / 2 - ROW_PILL_LEN / 2,
            h: ROW_PILL_LEN,
          });
        }
      } else {
        setRowHandle(null);
        setRowIndicator(null);
      }

      const lineY = cRect.top - coRect.top;
      if (rowIdx === 0) {
        if (yIn < HOVER_BAND_PX) {
          setColIndicator(null);
          setColHandle({
            col: colIdx,
            x: Math.min(
              cRect.left - coRect.left + cRect.width / 2,
              container.clientWidth - 16
            ),
            y: lineY,
          });
        } else {
          setColHandle(null);
          setColIndicator({
            col: colIdx,
            x: cRect.left - coRect.left + cRect.width / 2 - COL_PILL_LEN / 2,
            y: lineY - 4,
            w: COL_PILL_LEN,
          });
        }
      } else {
        setColHandle(null);
        if (colIdx === 0) {
          const tRect = tableEl.getBoundingClientRect();
          setColIndicator({
            col: 0,
            x: cRect.left - coRect.left + cRect.width / 2 - COL_PILL_LEN / 2,
            y: tRect.top - coRect.top - 4,
            w: COL_PILL_LEN,
          });
        } else {
          setColIndicator(null);
        }
      }
    };

    const nearTable = (e: { clientX: number; clientY: number }) => {
      const rect = tableRectRef.current;
      const containerEl = containerRef.current;
      if (!rect || !containerEl || !hovered) return false;
      const co = containerEl.getBoundingClientRect();
      const x = e.clientX - co.left;
      const y = e.clientY - co.top;
      return (
        x >= rect.left - 48 &&
        x <= rect.right + 48 &&
        y >= rect.top - 48 &&
        y <= rect.bottom + 48
      );
    };

    const inTrackZone = (e: { clientX: number; clientY: number }) => {
      const rect = tableRectRef.current;
      const containerEl = containerRef.current;
      if (!rect || !containerEl || !hovered) return false;
      const co = containerEl.getBoundingClientRect();
      const x = e.clientX - co.left;
      const y = e.clientY - co.top;
      const ZONE = 24;
      const rightStrip =
        x >= rect.right &&
        x <= rect.right + ZONE &&
        y >= rect.top - ZONE &&
        y <= rect.bottom + ZONE;
      const bottomStrip =
        y >= rect.bottom &&
        y <= rect.bottom + ZONE &&
        x >= rect.left - ZONE &&
        x <= rect.right + ZONE;
      const cornerZone =
        x >= rect.right - ZONE &&
        x <= rect.right + ZONE &&
        y >= rect.bottom - ZONE &&
        y <= rect.bottom + ZONE;
      return rightStrip || bottomStrip || cornerZone;
    };

    const anchorTable = (table: HTMLElement) => {
      setHovered(table);
      const r = table.getBoundingClientRect();
      const hit = editor.view.posAtCoords({
        left: r.left + 4,
        top: r.top + 4,
      });
      if (hit) {
        const $pos = editor.state.doc.resolve(hit.pos);
        for (let d = $pos.depth; d > 0; d--) {
          if ($pos.node(d).type.name === "table") {
            tableAnchorRef.current = { pos: $pos.start(d) + 1 };
            break;
          }
        }
      }
    };

    const resolveCellFromDragHandle = (
      e: { clientX: number; clientY: number },
      handleEl: HTMLElement
    ): HTMLElement | null => {
      const dr = handleEl.getBoundingClientRect();
      const probe = document.elementFromPoint(dr.right + 2, dr.bottom + 2);
      const tbl = probe?.closest("table");
      if (!tbl) return null;
      const rows = Array.from(tbl.rows);
      const rowIdx = rows.findIndex(
        (r) => e.clientY < r.getBoundingClientRect().bottom
      );
      if (rowIdx < 0) return null;
      const cells = Array.from(rows[rowIdx].cells);
      const colIdx = cells.findIndex(
        (c) => e.clientX < c.getBoundingClientRect().right
      );
      return colIdx < 0 ? null : (cells[colIdx] as HTMLElement);
    };

    const onMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target || !container.contains(target)) return;
      if (dragRef.current) return;
      const dhEl = target.closest<HTMLElement>(".drag-handle");
      if (dhEl) {
        const dr = dhEl.getBoundingClientRect();
        const probe = document.elementFromPoint(dr.right + 2, dr.bottom + 2);
        const tbl = probe?.closest("table");
        if (tbl) {
          anchorTable(tbl as HTMLElement);
        }
        return;
      }
      const tableEl = target.closest("table");
      if (tableEl) {
        anchorTable(tableEl as HTMLElement);
        return;
      }
      if (target.closest("[data-table-chrome]")) return;
      if (cornerDragRef.current) return;
      if (nearTable(e)) return;
      setHovered(null);
      clearChrome();
      closeMenus();
      setEdgeHit(false);
    };

    const onMouseLeave = (e: MouseEvent) => {
      if (dragRef.current) return;
      if (nearTable(e)) return;
      setHovered(null);
      clearChrome();
      closeMenus();
      setEdgeHit(false);
    };

    const measureSelection = () => {
      const containerEl = containerRef.current;
      if (!containerEl) return;
      const sel = editor.state.selection;
      const isCellSelection =
        sel &&
        typeof (sel as { $anchorCell?: unknown }).$anchorCell !== "undefined";
      if (isCellSelection) {
        const cells = Array.from(
          containerEl.querySelectorAll<HTMLElement>(".selectedCell")
        );
        if (cells.length > 0) {
          const rect = unionRect(containerEl, cells);
          const wrapper = cells[0].closest(".tableWrapper");
          setEdgeAction({
            mergeable: cells.length > 1,
            splittable: cells.length === 1,
          });
          setSelFrame(
            clampFrameToBox(rect, selectionBounds(containerEl, wrapper))
          );
          return;
        }
      }
      const $from = sel.$from;
      let cellNode: import("@tiptap/pm/model").Node | null = null;
      for (let d = $from.depth; d > 0; d--) {
        const n = $from.node(d);
        if (n.type.name === "tableCell" || n.type.name === "tableHeader") {
          cellNode = n;
          break;
        }
      }
      let toCell: import("@tiptap/pm/model").Node | null = null;
      for (let d = sel.$to.depth; d > 0; d--) {
        const n = sel.$to.node(d);
        if (n.type.name === "tableCell" || n.type.name === "tableHeader") {
          toCell = n;
          break;
        }
      }
      if (cellNode && toCell === cellNode) {
        const caretDom = editor.view.domAtPos($from.pos)
          .node as HTMLElement | null;
        const dom = caretDom && caretDom.closest
          ? caretDom.closest<HTMLElement>("td, th")
          : null;
        if (dom) {
          const rect = relRect(containerEl, dom);
          const wrapper = dom.closest(".tableWrapper");
          setEdgeAction({
            mergeable: false,
            splittable:
              cellNode.attrs.colspan > 1 || cellNode.attrs.rowspan > 1,
          });
          setSelFrame(
            clampFrameToBox(rect, selectionBounds(containerEl, wrapper))
          );
          return;
        }
      }
      setSelFrame(null);
      setEdgeAction({ mergeable: false, splittable: false });
    };

    const refresh = () => {
      refreshTableRect();
      measureSelection();
      const a = tableAnchorRef.current;
      if (
        a &&
        (rowMenuRef.current.open || colMenuRef.current.open)
      ) {
        const ref = getHoverTable(editor, a.pos);
        if (ref) setHeaderState(getHeaderState(ref));
      }
    };

    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const containerEl = containerRef.current;
      if (!target || !containerEl) return;

      const edgeZoneEl = target.closest<HTMLElement>("[data-edge-zone]");
      if (edgeZoneEl) {
        if (edgeMenuRef.current.open) {
          closeMenus();
          return;
        }
        const r = relRect(containerEl, edgeZoneEl);
        setEdgeMenu({
          left: r.left + r.width + 8,
          top: r.top + r.height / 2 - 56,
        });
        edgeMenuRef.current = { open: true };
        setColorOpen(false);
        return;
      }

      const rowHandleEl = target.closest<HTMLElement>(".table-row-handle");
      if (rowHandleEl) {
        if (suppressClickRef.current) {
          suppressClickRef.current = false;
          return;
        }
        const r = relRect(containerEl, rowHandleEl);
        const row = Number(rowHandleEl.dataset.row ?? 0);
        const anchor = tableAnchorRef.current;
        if (anchor) {
          const ref = getHoverTable(editor, anchor.pos);
          if (ref) {
            setHeaderState(getHeaderState(ref));
            selectRowCells(editor, ref, row);
          }
        }
        closeMenus();
        setRowMenu({ left: r.left, top: r.bottom + 6, row });
        rowMenuRef.current = { open: true, row };
        return;
      }

      const colHandleEl = target.closest<HTMLElement>(".table-col-handle");
      if (colHandleEl) {
        if (suppressClickRef.current) {
          suppressClickRef.current = false;
          return;
        }
        const r = relRect(containerEl, colHandleEl);
        const col = Number(colHandleEl.dataset.col ?? 0);
        const anchor = tableAnchorRef.current;
        if (anchor) {
          const ref = getHoverTable(editor, anchor.pos);
          if (ref) {
            setHeaderState(getHeaderState(ref));
            selectColumnCells(editor, ref, col);
          }
        }
        closeMenus();
        setColMenu({ left: r.left, top: r.bottom + 6, col });
        colMenuRef.current = { open: true, col };
        return;
      }

      const trackAddColEl = target.closest<HTMLElement>("[data-track-add-col]");
      if (trackAddColEl) {
        e.preventDefault();
        growTable(0, 1);
        return;
      }

      const trackAddRowEl = target.closest<HTMLElement>("[data-track-add-row]");
      if (trackAddRowEl) {
        e.preventDefault();
        growTable(1, 0);
        return;
      }

      const actionEl = target.closest<HTMLElement>("[data-table-action]");
      if (actionEl) {
        e.preventDefault();
        const action = actionEl.dataset.tableAction;
        if (action === "toggleHeaderRow" || action === "toggleHeaderCol") {
          const now = Date.now();
          if (
            lastToggleRef.current.action === action &&
            now - lastToggleRef.current.at < 120
          ) {
            return;
          }
          lastToggleRef.current = { action, at: now };
          if (action === "toggleHeaderRow") toggleHeaderRow();
          else toggleHeaderCol();
          return;
        }
        if (rowMenuRef.current.open) {
          const row = rowMenuRef.current.row;
          if (action === "addRowBefore") addRowBeforeAt(row);
          else if (action === "addRowAfter") addRowAfterAt(row);
          else if (action === "deleteRow") deleteRowAt(row);
          closeMenus();
          return;
        }
        if (colMenuRef.current.open) {
          const col = colMenuRef.current.col;
          if (action === "addColBefore") addColBeforeAt(col);
          else if (action === "addColAfter") addColAfterAt(col);
          closeMenus();
          return;
        }
        return;
      }

      if (
        (rowMenuRef.current.open ||
          colMenuRef.current.open ||
          edgeMenuRef.current.open) &&
        !target.closest("[data-table-menu]")
      ) {
        closeMenus();
      }
    };

    const tableRowRects = () => {
      const t = hovered as HTMLTableElement | null;
      if (!t) return [];
      return Array.from(t.rows).map((r) => r.getBoundingClientRect());
    };

    const tableColRects = () => {
      const t = hovered as HTMLTableElement | null;
      if (!t || t.rows.length === 0) return [];
      return Array.from(t.rows[0].children as HTMLCollectionOf<HTMLElement>).map(
        (c) => c.getBoundingClientRect()
      );
    };

    const rowSlotFromPointer = (clientY: number): number | null => {
      const rects = tableRowRects();
      if (rects.length === 0) return null;
      if (clientY < rects[0].top) return 0;
      if (clientY >= rects[rects.length - 1].bottom) return rects.length;
      for (let i = 0; i < rects.length; i++) {
        if (clientY < rects[i].top + rects[i].height / 2) return i;
      }
      return rects.length;
    };

    const colSlotFromPointer = (clientX: number): number | null => {
      const rects = tableColRects();
      if (rects.length === 0) return null;
      if (clientX < rects[0].left) return 0;
      if (clientX >= rects[rects.length - 1].right) return rects.length;
      for (let i = 0; i < rects.length; i++) {
        if (clientX < rects[i].left + rects[i].width / 2) return i;
      }
      return rects.length;
    };

    const rowDropIndicatorFor = (
      slot: number
    ): { vertical: boolean; pos: number; cross: number; length: number } | null => {
      if (!hovered) return null;
      const rects = tableRowRects();
      const co = container.getBoundingClientRect();
      const t = hovered.getBoundingClientRect();
      if (rects.length === 0) return null;
      const y =
        slot <= 0
          ? rects[0].top
          : slot >= rects.length
            ? rects[rects.length - 1].bottom
            : rects[slot - 1].bottom;
      return {
        vertical: false,
        pos: y - co.top,
        cross: t.left - co.left,
        length: t.width,
      };
    };

    const colDropIndicatorFor = (
      slot: number
    ): { vertical: boolean; pos: number; cross: number; length: number } | null => {
      if (!hovered) return null;
      const rects = tableColRects();
      const co = container.getBoundingClientRect();
      const t = hovered.getBoundingClientRect();
      if (rects.length === 0) return null;
      const x =
        slot <= 0
          ? rects[0].left
          : slot >= rects.length
            ? rects[rects.length - 1].right
            : rects[slot - 1].right;
      return {
        vertical: true,
        pos: x - co.left,
        cross: t.top - co.top,
        length: t.height,
      };
    };

    const sourceRectFor = (
      kind: "row" | "col",
      index: number
    ): Rect | null => {
      const t = hovered as HTMLTableElement | null;
      if (!t) return null;
      const co = container.getBoundingClientRect();
      const tr = t.getBoundingClientRect();
      if (kind === "row") {
        const r = t.rows[index];
        if (!r) return null;
        const rr = r.getBoundingClientRect();
        return {
          left: tr.left - co.left,
          top: rr.top - co.top,
          width: tr.width,
          height: rr.height,
          right: tr.right - co.left,
          bottom: rr.bottom - co.top,
        };
      }
      const firstRow = t.rows[0];
      if (!firstRow) return null;
      const c = firstRow.children[index] as HTMLElement | undefined;
      if (!c) return null;
      const cr = c.getBoundingClientRect();
      return {
        left: cr.left - co.left,
        top: tr.top - co.top,
        width: cr.width,
        height: tr.height,
        right: cr.right - co.left,
        bottom: tr.bottom - co.top,
      };
    };

    function rowHandleStart(e: PointerEvent, handleEl: HTMLElement) {
      if (!editor) return;
      if (dragRef.current) return;
      const a = tableAnchorRef.current;
      if (!a) return;
      const ref = getHoverTable(editor, a.pos);
      if (!ref || ref.rows <= 1) return;
      const row = Number(handleEl.dataset.row ?? 0);
      if (row < 0 || row >= ref.rows) return;
      if (hasRowspanCells(ref)) return;
      closeMenus();
      setHeaderState(getHeaderState(ref));
      selectRowCells(editor, ref, row);
      const source = sourceRectFor("row", row);
      if (!source) return;
      dragRef.current = { kind: "row", from: row, dragging: false };
      setDragState({ kind: "row", from: row, source });
      const onMove = (ev: PointerEvent) => {
        const drag = dragRef.current;
        if (!drag) return;
        if (!drag.dragging) {
          if (
            Math.abs(ev.clientX - e.clientX) + Math.abs(ev.clientY - e.clientY) <
            5
          ) {
            return;
          }
          drag.dragging = true;
          suppressClickRef.current = true;
          document.body.style.userSelect = "none";
        }
        const src = sourceRectFor("row", drag.from);
        if (src) setDragState({ kind: "row", from: drag.from, source: src });
        const slot = rowSlotFromPointer(ev.clientY);
        if (slot === null) return;
        const finalIndex = slot > drag.from ? slot - 1 : slot;
        setDropIndicator(finalIndex === drag.from ? null : rowDropIndicatorFor(slot));
      };
      const onUp = (ev: PointerEvent) => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        const drag = dragRef.current;
        dragRef.current = null;
        setDragState(null);
        setDropIndicator(null);
        document.body.style.userSelect = "";
        if (!drag || !drag.dragging) return;
        const a2 = tableAnchorRef.current;
        if (!a2) return;
        const slot = rowSlotFromPointer(ev.clientY);
        if (slot === null) return;
        const finalIndex = slot > drag.from ? slot - 1 : slot;
        if (finalIndex !== drag.from) {
          moveRowTo(editor, a2.pos, drag.from, finalIndex);
        }
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    }

    function colHandleStart(e: PointerEvent, handleEl: HTMLElement) {
      if (!editor) return;
      if (dragRef.current) return;
      const a = tableAnchorRef.current;
      if (!a) return;
      const ref = getHoverTable(editor, a.pos);
      if (!ref || ref.cols <= 1) return;
      const col = Number(handleEl.dataset.col ?? 0);
      if (col < 0 || col >= ref.cols) return;
      if (hasMergedCells(ref)) return;
      closeMenus();
      setHeaderState(getHeaderState(ref));
      selectColumnCells(editor, ref, col);
      const source = sourceRectFor("col", col);
      if (!source) return;
      dragRef.current = { kind: "col", from: col, dragging: false };
      setDragState({ kind: "col", from: col, source });
      const onMove = (ev: PointerEvent) => {
        const drag = dragRef.current;
        if (!drag) return;
        if (!drag.dragging) {
          if (
            Math.abs(ev.clientX - e.clientX) + Math.abs(ev.clientY - e.clientY) <
            5
          ) {
            return;
          }
          drag.dragging = true;
          suppressClickRef.current = true;
          document.body.style.userSelect = "none";
        }
        const src = sourceRectFor("col", drag.from);
        if (src) setDragState({ kind: "col", from: drag.from, source: src });
        const slot = colSlotFromPointer(ev.clientX);
        if (slot === null) return;
        const finalIndex = slot > drag.from ? slot - 1 : slot;
        setDropIndicator(finalIndex === drag.from ? null : colDropIndicatorFor(slot));
      };
      const onUp = (ev: PointerEvent) => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        const drag = dragRef.current;
        dragRef.current = null;
        setDragState(null);
        setDropIndicator(null);
        document.body.style.userSelect = "";
        if (!drag || !drag.dragging) return;
        const a2 = tableAnchorRef.current;
        if (!a2) return;
        const slot = colSlotFromPointer(ev.clientX);
        if (slot === null) return;
        const finalIndex = slot > drag.from ? slot - 1 : slot;
        if (finalIndex !== drag.from) {
          moveColumnTo(editor, a2.pos, drag.from, finalIndex);
        }
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    }

    const onPointerDown = (e: PointerEvent) => {
      suppressClickRef.current = false;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const rowHandleEl = target.closest<HTMLElement>(".table-row-handle");
      if (rowHandleEl) {
        rowHandleStart(e, rowHandleEl);
        return;
      }
      const colHandleEl = target.closest<HTMLElement>(".table-col-handle");
      if (colHandleEl) {
        colHandleStart(e, colHandleEl);
        return;
      }
      if (target.closest(".table-corner")) {
        cornerStart(e);
      }
    };

    container.addEventListener("mouseover", onMouseOver);
    container.addEventListener("mouseleave", onMouseLeave);
    container.addEventListener("click", onClick);
    container.addEventListener("pointermove", onPointerMove);
    container.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("scroll", refresh, true);
    window.addEventListener("resize", refresh);
    editor.on("update", refresh);
    editor.on("selectionUpdate", measureSelection);
    editor.on("transaction", measureSelection);

    return () => {
      container.removeEventListener("mouseover", onMouseOver);
      container.removeEventListener("mouseleave", onMouseLeave);
      container.removeEventListener("click", onClick);
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("scroll", refresh, true);
      window.removeEventListener("resize", refresh);
      editor.off("update", refresh);
      editor.off("selectionUpdate", measureSelection);
      editor.off("transaction", measureSelection);
    };
  }, [editor, containerRef, tableAnchorRef, refreshTableRect, hovered, toggleHeaderRow, toggleHeaderCol]);

  if (!editor) return null;

  const mergeCells = () => {
    editor.chain().focus().mergeCells().run();
  };

  const splitCell = () => {
    editor.chain().focus().splitCell().run();
  };

  const closeEdgeMenu = () => {
    setEdgeMenu(null);
    edgeMenuRef.current = { open: false };
    setColorOpen(false);
  };

  const setCellColor = (color: string | null) => {
    editor.chain().focus().setCellAttribute("backgroundColor", color).run();
    closeEdgeMenu();
  };

  const TRACK_GAP = 4;
  const trackX = (wrapperRect?.right ?? tableRect?.right ?? 0) + TRACK_GAP;
  const trackLeft = wrapperRect?.left ?? tableRect?.left ?? 0;
  const trackWidth = wrapperRect?.width ?? tableRect?.width ?? 0;

  return (
    <>
      {hovered && tableRect && (
        <>
          {rowIndicator && (
            <div
              className="table-row-line"
              style={{
                left: rowIndicator.x,
                top: rowIndicator.y,
                height: rowIndicator.h,
              }}
            />
          )}
          {colIndicator && (
            <div
              className="table-col-line"
              style={{
                left: colIndicator.x,
                top: colIndicator.y,
                width: colIndicator.w,
              }}
            />
          )}
          {rowHandle && (
            <button
              data-table-chrome
              type="button"
              className="table-row-handle"
              data-row={rowHandle.row}
              style={{ left: rowHandle.x, top: rowHandle.y }}
              title="Row options"
              aria-label="Row options"
            >
              <GripVerticalIcon />
            </button>
          )}
          {colHandle && (
            <button
              data-table-chrome
              type="button"
              className="table-col-handle"
              data-col={colHandle.col}
              style={{ left: colHandle.x, top: colHandle.y }}
              title="Column options"
              aria-label="Column options"
            >
              <GripHorizontalIcon />
            </button>
          )}
          {edgeHit && (
            <>
              <div
                data-table-chrome
                data-track-add-col
                className="table-edge-track table-edge-track-v"
                style={{
                  left: trackX,
                  top: tableRect.top,
                  height: tableRect.height,
                }}
                title="Add column"
              >
                <button
                  type="button"
                  className="table-edge-track-plus"
                  aria-label="Add column"
                >
                  <PlusIcon />
                </button>
              </div>
              <div
                data-table-chrome
                data-track-add-row
                className="table-edge-track table-edge-track-h"
                style={{
                  left: trackLeft,
                  top: tableRect.bottom + TRACK_GAP,
                  width: trackWidth,
                }}
                title="Add row"
              >
                <button
                  type="button"
                  className="table-edge-track-plus"
                  aria-label="Add row"
                >
                  <PlusIcon />
                </button>
              </div>
              <div
                data-table-chrome
                className="table-corner"
                style={{
                  left: trackX,
                  top: tableRect.bottom + TRACK_GAP,
                }}
                title="Drag to resize the table"
              >
                <PlusIcon />
                {corner && (corner.rows !== 0 || corner.cols !== 0) && (
                  <span className="table-corner-badge">
                    {corner.rows !== 0
                      ? `${corner.rows > 0 ? "+" : ""}${corner.rows} row${
                          Math.abs(corner.rows) === 1 ? "" : "s"
                        }`
                      : ""}
                    {corner.rows !== 0 && corner.cols !== 0 ? ", " : ""}
                    {corner.cols !== 0
                      ? `${corner.cols > 0 ? "+" : ""}${corner.cols} col${
                          Math.abs(corner.cols) === 1 ? "" : "s"
                        }`
                      : ""}
                  </span>
                )}
              </div>
            </>
          )}
        </>
      )}
      {dragState && (
        <div
          data-table-chrome
          className="table-drag-source"
          style={{
            left: dragState.source.left,
            top: dragState.source.top,
            width: dragState.source.width,
            height: dragState.source.height,
          }}
        />
      )}
      {dropIndicator && (
        <div
          data-table-chrome
          className="table-drop-indicator"
          style={
            dropIndicator.vertical
              ? {
                  left: dropIndicator.pos - 1,
                  top: dropIndicator.cross,
                  width: 2,
                  height: dropIndicator.length,
                }
              : {
                  left: dropIndicator.cross,
                  top: dropIndicator.pos - 1,
                  width: dropIndicator.length,
                  height: 2,
                }
          }
        />
      )}
      {selFrame && (
        <div
          data-table-chrome
          className="table-selection-frame"
          style={{
            left: selFrame.left,
            top: selFrame.top,
            width: selFrame.width,
            height: selFrame.height,
          }}
        />
      )}
      {selFrame && (
        <div
          data-table-chrome
          data-edge-zone
          className="table-edge-zone"
          style={{
            left: selFrame.left + selFrame.width - 13,
            top: selFrame.top + selFrame.height / 2 - 16,
          }}
        >
          {edgeHovered ? (
            <button type="button" className="table-edge-handle" title="Cell options" aria-label="Cell options">
              <EllipsisVerticalIcon />
            </button>
          ) : (
            <span className="table-edge-line" />
          )}
        </div>
      )}
      {edgeMenu && (
        <div
          data-table-menu
          data-table-chrome
          className="table-header-menu table-edge-menu"
          style={{ left: edgeMenu.left, top: edgeMenu.top }}
        >
          <button type="button" className={colorOpen ? "active" : ""} onClick={() => setColorOpen(!colorOpen)}>
            <PaintBucketIcon /> Color
          </button>
          {colorOpen && (
            <div className="table-swatch-row">
              {CELL_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="table-swatch"
                  style={{ backgroundColor: c }}
                  onClick={() => setCellColor(c)}
                  aria-label={c}
                />
              ))}
              <button
                type="button"
                className="table-swatch table-swatch-none"
                onClick={() => setCellColor(null)}
                title="No color"
                aria-label="No color"
              />
            </div>
          )}
          <button type="button" disabled={!edgeAction.mergeable} onClick={mergeCells}>
            <MergeIcon /> Merge cells
          </button>
          <button type="button" disabled={!edgeAction.splittable} onClick={splitCell}>
            <SplitIcon /> Split cell
          </button>
        </div>
      )}
      {rowMenu && (
        <div
          data-table-menu
          data-table-chrome
          className="table-header-menu"
          style={{ left: rowMenu.left, top: rowMenu.top }}
        >
          <label data-table-action="toggleHeaderRow">
            <span className="table-menu-item">
              <RowPropertiesIcon /> Header row
            </span>
            <Switch checked={headerState.row} />
          </label>
          <button type="button" data-table-action="addRowBefore">
            <MoveUpIcon /> Add row above
          </button>
          <button type="button" data-table-action="addRowAfter">
            <MoveDownIcon /> Add row below
          </button>
          <button type="button" data-table-action="deleteRow">
            <Trash2Icon /> Delete row
          </button>
        </div>
      )}
      {colMenu && (
        <div
          data-table-menu
          data-table-chrome
          className="table-header-menu"
          style={{ left: colMenu.left, top: colMenu.top }}
        >
          <label data-table-action="toggleHeaderCol">
            <span className="table-menu-item">
              <ColPropertiesIcon /> Header column
            </span>
            <Switch checked={headerState.col} />
          </label>
          <button type="button" data-table-action="addColBefore">
            <MoveLeftIcon /> Add column left
          </button>
          <button type="button" data-table-action="addColAfter">
            <MoveRightIcon /> Add column right
          </button>
        </div>
      )}
    </>
  );
}