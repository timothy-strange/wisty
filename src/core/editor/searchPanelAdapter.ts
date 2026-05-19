import { closeSearchPanel, openSearchPanel, searchPanelOpen } from "@codemirror/search";
import type { EditorView } from "@codemirror/view";

const FIND_INPUT_SELECTOR = ".cm-search input[name='search']";
const REPLACE_INPUT_SELECTOR = ".cm-search input[name='replace']";

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

const inputIsFocused = (view: EditorView, selector: string): boolean => {
  return view.dom.querySelector(selector) === document.activeElement;
};

const closePanelAndFocusEditor = (view: EditorView): void => {
  closeSearchPanel(view);
  view.focus();
};

export const createSearchPanelAdapter = () => {
  const openOrFocusFindPanel = (view: EditorView): boolean => {
    if (searchPanelOpen(view.state) && inputIsFocused(view, FIND_INPUT_SELECTOR)) {
      closePanelAndFocusEditor(view);
      return true;
    }

    const opened = ensurePanelOpen(view);
    focusInput(view, FIND_INPUT_SELECTOR);
    return opened;
  };

  const openOrFocusReplacePanel = (view: EditorView): boolean => {
    if (searchPanelOpen(view.state) && inputIsFocused(view, REPLACE_INPUT_SELECTOR)) {
      closePanelAndFocusEditor(view);
      return true;
    }

    const opened = ensurePanelOpen(view);
    focusInput(view, REPLACE_INPUT_SELECTOR);
    return opened;
  };

  return {
    openOrFocusFindPanel,
    openOrFocusReplacePanel
  };
};
