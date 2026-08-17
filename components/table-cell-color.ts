import { TableCell, TableHeader } from "@tiptap/extension-table";

const backgroundColor = {
  default: null as string | null,
  parseHTML: (element: HTMLElement) => element.style.backgroundColor || null,
  renderHTML: (attributes: { backgroundColor?: string | null }) =>
    attributes.backgroundColor
      ? { style: `background-color: ${attributes.backgroundColor}` }
      : {},
};

export const ColoredTableCell = TableCell.extend({
  addAttributes() {
    return { ...this.parent?.(), backgroundColor };
  },
});

export const ColoredTableHeader = TableHeader.extend({
  addAttributes() {
    return { ...this.parent?.(), backgroundColor };
  },
});
