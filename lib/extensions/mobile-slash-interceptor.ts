"use client";

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

export type MobileSlashOptions = {
  onOpenPicker: (from: number, to: number) => void;
};

export const MobileSlashInterceptor = Extension.create<MobileSlashOptions>({
  name: "mobileSlashInterceptor",

  addOptions() {
    return {
      onOpenPicker: () => {},
    };
  },

  addProseMirrorPlugins() {
    const { onOpenPicker } = this.options;

    const key = new PluginKey("mobileSlashInterceptor");

    return [
      new Plugin({
        key,
        props: {
          handleKeyDown(view, event) {
            // Behavior only on mobile viewports — check at call time, not options time
            const isMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
            if (!isMobile) return false;
            if (event.key !== "/") return false;
            if (event.ctrlKey || event.metaKey || event.altKey) return false;
            if (event.isComposing) return false;
            const { $from } = view.state.selection;
            if (!$from.parent.isTextblock) return false;
            if (!view.state.selection.empty) return false;
            const textBefore = $from.parent.textBetween(0, $from.parentOffset);
            // Only intercept if slash at start or after whitespace
            if (!/(^|\s)$/.test(textBefore)) return false;

            const from = view.state.selection.from;
            const to = view.state.selection.to;
            // Prevent "/" from being inserted, open picker, no slash to delete
            event.preventDefault();
            event.stopPropagation();
            onOpenPicker(from, to);
            return true;
          },
        },
      }),
    ];
  },
});
