import { closeSearchPanel, openSearchPanel, searchPanelOpen } from "@codemirror/search";
import type { EditorView } from "@codemirror/view";

const togglePanel = (view: EditorView): boolean => {
  if (searchPanelOpen(view.state)) {
    return closeSearchPanel(view);
  }
  return openSearchPanel(view);
};

export const createSearchPanelAdapter = () => {
  const toggleFindPanel = (view: EditorView): boolean => togglePanel(view);

  const toggleReplacePanel = (view: EditorView): boolean => togglePanel(view);

  return {
    toggleFindPanel,
    toggleReplacePanel
  };
};
