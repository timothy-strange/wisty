import { openSearchPanel, searchPanelOpen } from "@codemirror/search";
import type { EditorView } from "@codemirror/view";

const focusInput = (view: EditorView, selector: string) => {
  const focusNow = () => {
    const element = view.dom.querySelector<HTMLInputElement>(selector);
    if (!element) {
      return false;
    }
    element.focus();
    element.select();
    return true;
  };

  if (focusNow()) {
    return;
  }

  requestAnimationFrame(() => {
    void focusNow();
  });
};

const ensurePanelOpen = (view: EditorView): boolean => {
  if (searchPanelOpen(view.state)) {
    return true;
  }
  return openSearchPanel(view);
};

export const createSearchPanelAdapter = () => {
  const openOrFocusFindPanel = (view: EditorView): boolean => {
    const opened = ensurePanelOpen(view);
    focusInput(view, ".cm-search input[name='search']");
    return opened;
  };

  const openOrFocusReplacePanel = (view: EditorView): boolean => {
    const opened = ensurePanelOpen(view);
    focusInput(view, ".cm-search input[name='replace']");
    return opened;
  };

  return {
    openOrFocusFindPanel,
    openOrFocusReplacePanel
  };
};
