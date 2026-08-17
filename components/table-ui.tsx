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

function getHoverTable(editor: Editor, hoverPos: number): TableRef | null {
  const $pos = editor.state.doc.resolve(Math.max(0, Math.min(hoverPos, editor.state.doc.content.size)));
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
  const row = table.firstChild?.firstChild?.type.name === "tableHeader";
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

function clampFrame(container: HTMLElement, rect: Rect): Rect | null {
  const cw = container.clientWidth;
  const ch = container.clientHeight;
  const left = Math.max(0, Math.min(rect.left, cw - 2));
  const top = Math.max(0, Math.min(rect.top, ch - 2));
  const right = Math.min(cw - 1, Math.max(rect.right, left + 2));
  const bottom = Math.min(ch - 1, Math.max(rect.bottom, top + 2));
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
  const [containerW, setContainerW] = React.useState(0);
  const [selFrame, setSelFrame] = React.useState<Rect | null>(null);

  const rowMenuRef = React.useRef<{ open: boolean; row: number }>({
    open: false,
    row: 0,
  });
  const colMenuRef = React.useRef<{ open: boolean; col: number }>({
    open: false,
    col: 0,
  });
  const edgeMenuRef = React.useRef<{ open: boolean }>({ open: false });
  const cornerDragRef = React.useRef<{
    startX: number;
    startY: number;
    rows: number;
    cols: number;
  } | null>(null);

  const refreshTableRect = React.useCallback(() => {
    const container = containerRef.current;
    if (!container || !hovered) {
      setTableRect(null);
      setContainerW(0);
      return;
    }
    setTableRect(relRect(container, hovered));
    setContainerW(container.clientWidth);
  }, [containerRef, hovered]);

  React.useEffect(() => {
    refreshTableRect();
  }, [hovered, refreshTableRect]);

  const toggleHeaderRow = React.useCallback(() => {
    const a = tableAnchorRef.current;
    const ref = a ? getHoverTable(editor, a.pos) : null;
    const merged = ref ? hasMergedCells(ref) : false;
    const p = ref ? cellContentPos(ref, 0, 0) : null;
    if (!ref || merged) return;
    if (p === null) return;
    editor.chain().focus().setTextSelection(p).toggleHeaderRow().fixTables().run();
    setHeaderState(getHeaderState(ref));
  }, [editor, tableAnchorRef]);

  const toggleHeaderCol = React.useCallback(() => {
    const a = tableAnchorRef.current;
    if (!a) return;
    const ref = getHoverTable(editor, a.pos);
    if (!ref || hasMergedCells(ref)) return;
    const p = cellContentPos(ref, 0, 0);
    if (p === null) return;
    editor.chain().focus().setTextSelection(p).toggleHeaderColumn().fixTables().run();
    setHeaderState(getHeaderState(ref));
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
      const a = tableAnchorRef.current;
      if (!a || (rowsToAdd <= 0 && colsToAdd <= 0)) return;
      let ref = getHoverTable(editor, a.pos);
      if (!ref) return;
      const last = cellContentPos(ref, ref.rows - 1, ref.cols - 1);
      if (last !== null && rowsToAdd > 0) {
        let chain = editor.chain().focus().setTextSelection(last);
        for (let i = 0; i < rowsToAdd; i++) chain = chain.addRowAfter();
        chain.run();
      }
      ref = getHoverTable(editor, a.pos);
      if (!ref) return;
      const firstRowLast = cellContentPos(ref, 0, ref.cols - 1);
      if (firstRowLast !== null && colsToAdd > 0) {
        let chain = editor.chain().focus().setTextSelection(firstRowLast);
        for (let i = 0; i < colsToAdd; i++) chain = chain.addColumnAfter();
        chain.run();
      }
    }

    function cornerStart(e: PointerEvent) {
      if (!hovered || !tableAnchorRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      cornerDragRef.current = { startX: e.clientX, startY: e.clientY, rows: 0, cols: 0 };
      setCorner({ rows: 0, cols: 0 });
      clearChrome();
      const onMove = (ev: PointerEvent) => {
        const drag = cornerDragRef.current;
        const a = tableAnchorRef.current;
        if (!drag || !hovered || !a) return;
        const rect = hovered.getBoundingClientRect();
        const ref = getHoverTable(editor, a.pos);
        if (!ref) return;
        const rows = Math.max(ref.rows, 1);
        const cols = Math.max(ref.cols, 1);
        const rowH = rect.height / rows;
        const colW = rect.width / cols;
        const addedRows = Math.min(
          20,
          Math.max(0, Math.round((ev.clientY - drag.startY) / Math.max(rowH, 1)))
        );
        const addedCols = Math.min(
          20,
          Math.max(0, Math.round((ev.clientX - drag.startX) / Math.max(colW, 1)))
        );
        drag.rows = addedRows;
        drag.cols = addedCols;
        setCorner({ rows: addedRows, cols: addedCols });
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        const drag = cornerDragRef.current;
        cornerDragRef.current = null;
        setCorner(null);
        if (drag && (drag.rows > 0 || drag.cols > 0)) {
          growTable(drag.rows, drag.cols);
        }
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    }

    function addRowBeforeAt(row: number) {
      const a = tableAnchorRef.current;
      if (!a) return;
      const ref = getHoverTable(editor, a.pos);
      if (!ref) return;
      const p = cellContentPos(ref, row, 0);
      if (p === null) return;
      editor.chain().focus().setTextSelection(p).addRowBefore().run();
    }

    function addRowAfterAt(row: number) {
      const a = tableAnchorRef.current;
      if (!a) return;
      const ref = getHoverTable(editor, a.pos);
      if (!ref) return;
      const p = cellContentPos(ref, row, ref.cols - 1);
      if (p === null) return;
      editor.chain().focus().setTextSelection(p).addRowAfter().run();
    }

    function deleteRowAt(row: number) {
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

    function addColBeforeAt(col: number) {
      const a = tableAnchorRef.current;
      if (!a) return;
      const ref = getHoverTable(editor, a.pos);
      if (!ref) return;
      const p = cellContentPos(ref, 0, col);
      if (p === null) return;
      editor.chain().focus().setTextSelection(p).addColumnBefore().run();
    }

    function addColAfterAt(col: number) {
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
      if (target.closest("[data-edge-zone]")) {
        setEdgeHovered(true);
        return;
      }
      if (rowMenuRef.current.open || colMenuRef.current.open) return;
      const cell = target.closest<HTMLElement>("td, th");
      if (!cell) {
        if (!target.closest("[data-table-chrome]")) {
          clearChrome();
        } else {
          setEdgeHovered(false);
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

    const onMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target || !container.contains(target)) return;
      if (target.closest("table")) {
        const table = target.closest("table") as HTMLElement;
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
        return;
      }
      if (target.closest(".drag-handle")) return;
      if (target.closest("[data-table-chrome]")) return;
      setHovered(null);
      clearChrome();
      closeMenus();
    };

    const onMouseLeave = () => {
      setHovered(null);
      clearChrome();
      closeMenus();
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
          setEdgeAction({
            mergeable: cells.length > 1,
            splittable: cells.length === 1,
          });
          setSelFrame(clampFrame(containerEl, rect));
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
          setEdgeAction({
            mergeable: false,
            splittable:
              cellNode.attrs.colspan > 1 || cellNode.attrs.rowspan > 1,
          });
          setSelFrame(clampFrame(containerEl, rect));
          return;
        }
      }
      setSelFrame(null);
      setEdgeAction({ mergeable: false, splittable: false });
    };

    const refresh = () => {
      refreshTableRect();
      measureSelection();
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

      const actionEl = target.closest<HTMLElement>("[data-table-action]");
      if (actionEl) {
        e.preventDefault();
        const action = actionEl.dataset.tableAction;
        if (action === "toggleHeaderRow") {
          toggleHeaderRow();
          return;
        }
        if (action === "toggleHeaderCol") {
          toggleHeaderCol();
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

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest(".table-corner")) {
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
          <div
            data-table-chrome
            className="table-corner"
            style={{
              left: Math.min(tableRect.right, containerW - 8),
              top: tableRect.bottom,
            }}
            title="Drag to resize the table"
          >
            <PlusIcon />
            {corner && (corner.rows > 0 || corner.cols > 0) && (
              <span className="table-corner-badge">
                {corner.rows > 0
                  ? `${corner.rows} row${corner.rows === 1 ? "" : "s"}`
                  : ""}
                {corner.rows > 0 && corner.cols > 0 ? ", " : ""}
                {corner.cols > 0
                  ? `${corner.cols} col${corner.cols === 1 ? "" : "s"}`
                  : ""}
              </span>
            )}
          </div>
        </>
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