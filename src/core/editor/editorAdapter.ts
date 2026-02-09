import { Compartment, EditorState, Transaction } from "@codemirror/state";
import { defaultKeymap, history, isolateHistory, redo, undo } from "@codemirror/commands";
import { highlightSelectionMatches, search, searchKeymap } from "@codemirror/search";
import { drawSelection, dropCursor, EditorView, highlightActiveLine, keymap } from "@codemirror/view";
import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
import { AppSettings } from "../settings/settingsTypes";
import { createSearchPanelAdapter } from "./searchPanelAdapter";

type DocChangedPayload = {
  revision: number;
};

type EditorAdapterOptions = {
  onDocChanged: (payload: DocChangedPayload) => void;
  getSettings: () => AppSettings;
};

type SetTextOptions = {
  emitChange?: boolean;
};

export const createEditorAdapter = (options: EditorAdapterOptions) => {
  let editorHost: HTMLDivElement | undefined;
  let editorView: EditorView | undefined;
  let revision = 0;
  let suppressDocEvents = 0;
  const searchPanelAdapter = createSearchPanelAdapter();

  const wrapCompartment = new Compartment();
  const styleCompartment = new Compartment();
  const activeLineCompartment = new Compartment();
  const selectionMatchesCompartment = new Compartment();

  const createStyleExtension = () => {
    const settings = options.getSettings();
    const isDark = settings.themeMode === "dark";

    return EditorView.theme({
      "&": {
        height: "100%",
        color: isDark ? "#d7dfef" : "#1c2736",
        "background-color": isDark ? "#111925" : "#ffffff",
        "font-family": settings.fontFamily,
        "font-size": `${settings.fontSize}px`
      },
      ".cm-content": {
        padding: "12px 14px",
        "min-height": "100%",
        "font-family": settings.fontFamily,
        "font-style": settings.fontStyle,
        "font-weight": `${settings.fontWeight}`,
        caretColor: isDark ? "#8cb2ff" : "#2451c5"
      },
      ".cm-gutters": {
        "background-color": isDark ? "#111925" : "#ffffff",
        color: isDark ? "#4f657f" : "#9aacbf",
        border: "none"
      },
      ".cm-scroller": {
        overflow: "auto",
        "font-family": settings.fontFamily,
        "font-style": settings.fontStyle,
        "font-weight": `${settings.fontWeight}`,
        "line-height": "1.55"
      },
      ".cm-activeLine": {
        background: isDark ? "rgba(124, 152, 202, 0.14)" : "rgba(194, 214, 246, 0.34)"
      },
      ".cm-selectionBackground, .cm-content ::selection": {
        background: isDark ? "rgba(90, 132, 211, 0.45)" : "rgba(133, 171, 238, 0.45)"
      },
      ".cm-panels-top": {
        border: "none",
        "border-top": `${isDark ? "1px solid #374151" : "1px solid #e5e7eb"} !important`,
        "border-bottom": `${isDark ? "1px solid #374151" : "1px solid #e5e7eb"} !important`,
        padding: "6px 8px",
        "background-color": `${isDark ? "#1f2937" : "#ffffff"} !important`,
        color: isDark ? "#ffffff" : "#000000"
      },
      ".cm-panel.cm-search": {
        border: "none !important"
      },
      ".cm-panels": {
        "background-color": `${isDark ? "#1f2937" : "#ffffff"} !important`,
        color: isDark ? "#ffffff" : "#000000"
      },
      ".cm-search": {
        "font-size": `${settings.findReplaceFontSize}px`,
        color: isDark ? "#ffffff" : "#000000",
        "background-color": isDark ? "#1f2937" : "#ffffff"
      },
      ".cm-search label": {
        color: isDark ? "#ffffff" : "#000000"
      },
      ".cm-search [name=close]": {
        color: isDark ? "#ffffff" : "#1f2937",
        opacity: "0.85"
      },
      ".cm-search [name=close]:hover": {
        opacity: "1"
      },
      ".cm-search input": {
        border: isDark ? "1px solid #374151" : "1px solid #e5e7eb",
        padding: "3px 6px",
        "border-radius": "4px",
        color: isDark ? "#d7dfef" : "#1c2736",
        "background-color": isDark ? "#152130" : "#ffffff"
      },
      ".cm-search input:focus": {
        outline: "none",
        "border-color": isDark ? "#4b6b99" : "#9eb7df",
        "box-shadow": isDark ? "0 0 0 1px #4b6b99" : "0 0 0 1px #9eb7df"
      },
      ".cm-search input[type=checkbox]": {
        "accent-color": isDark ? "#8cb2ff" : "#2451c5"
      },
      ".cm-panels .cm-button": {
        border: isDark ? "1px solid #374151" : "1px solid #e5e7eb",
        "border-radius": "4px",
        padding: "3px 7px",
        color: isDark ? "#ffffff" : "#000000",
        "background-color": isDark ? "#374151" : "#f3f4f6",
        "background-image": "none",
        appearance: "none"
      },
      ".cm-panels .cm-button:hover": {
        "background-color": isDark ? "#4b5563" : "#e5e7eb"
      },
      ".cm-panels .cm-button:active": {
        "background-color": isDark ? "#334155" : "#dbe3ee"
      }
    }, { dark: isDark });
  };

  const setHost = (node: HTMLDivElement) => {
    editorHost = node;
  };

  const init = () => {
    if (!editorHost || editorView) {
      return;
    }

    const settings = options.getSettings();
    const historyBoundaryExtension = EditorState.transactionExtender.of((tr) => {
      if (!tr.docChanged) {
        return null;
      }
      if (tr.isUserEvent("undo") || tr.isUserEvent("redo")) {
        return null;
      }

      if (tr.isUserEvent("delete.cut") || tr.isUserEvent("input.paste")) {
        return { annotations: isolateHistory.of("full") };
      }

      if (!tr.isUserEvent("input.type")) {
        return null;
      }

      let crossedWordBoundary = false;
      tr.changes.iterChanges((_fromA, _toA, _fromB, _toB, inserted) => {
        if (crossedWordBoundary) {
          return;
        }
        if (/[\s.,;:!?()[\]{}]/.test(inserted.toString())) {
          crossedWordBoundary = true;
        }
      });

      if (!crossedWordBoundary) {
        return null;
      }

      return { annotations: isolateHistory.of("after") };
    });

    editorView = new EditorView({
      parent: editorHost,
      state: EditorState.create({
        doc: "",
        extensions: [
          search(),
          history({
            newGroupDelay: 150,
            joinToEvent: (tr, isAdjacent) => {
              if (!isAdjacent) {
                return false;
              }
              return tr.isUserEvent("input.type") || tr.isUserEvent("delete.backward") || tr.isUserEvent("delete.forward");
            }
          }),
          historyBoundaryExtension,
          drawSelection(),
          dropCursor(),
          keymap.of([
            ...defaultKeymap,
            ...searchKeymap.filter((binding) => binding.key !== "Mod-f")
          ]),
          wrapCompartment.of(settings.textWrapEnabled ? EditorView.lineWrapping : []),
          styleCompartment.of(createStyleExtension()),
          activeLineCompartment.of(settings.highlightCurrentLineEnabled ? highlightActiveLine() : []),
          selectionMatchesCompartment.of(settings.highlightSelectionMatchesEnabled ? highlightSelectionMatches() : []),
          EditorView.updateListener.of((update) => {
            if (!update.docChanged) {
              return;
            }
            revision += 1;
            if (suppressDocEvents > 0) {
              return;
            }
            options.onDocChanged({ revision });
          })
        ]
      })
    });
  };

  const destroy = () => {
    if (!editorView) {
      return;
    }
    editorView.destroy();
    editorView = undefined;
  };

  const focus = () => {
    editorView?.focus();
  };

  const getText = () => editorView?.state.doc.toString() ?? "";

  const getRevision = () => revision;

  const setText = (text: string, setTextOptions: SetTextOptions = {}) => {
    if (!editorView) {
      return;
    }
    const emitChange = setTextOptions.emitChange ?? true;
    if (!emitChange) {
      suppressDocEvents += 1;
    }
    try {
      editorView.dispatch({
        changes: {
          from: 0,
          to: editorView.state.doc.length,
          insert: text
        }
      });
    } finally {
      if (!emitChange) {
        suppressDocEvents = Math.max(0, suppressDocEvents - 1);
      }
    }
  };

  const applySettings = () => {
    if (!editorView) {
      return;
    }
    const settings = options.getSettings();
    editorView.dispatch({
      effects: [
        wrapCompartment.reconfigure(settings.textWrapEnabled ? EditorView.lineWrapping : []),
        styleCompartment.reconfigure(createStyleExtension()),
        activeLineCompartment.reconfigure(settings.highlightCurrentLineEnabled ? highlightActiveLine() : []),
        selectionMatchesCompartment.reconfigure(settings.highlightSelectionMatchesEnabled ? highlightSelectionMatches() : [])
      ]
    });
  };

  const toggleFindPanel = () => {
    if (!editorView) {
      return false;
    }
    return searchPanelAdapter.toggleFindPanel(editorView);
  };

  const toggleReplacePanel = () => {
    if (!editorView) {
      return false;
    }
    return searchPanelAdapter.toggleReplacePanel(editorView);
  };

  const getSelectedText = () => {
    const view = editorView;
    if (!view) {
      return "";
    }
    const ranges = view.state.selection.ranges.filter((range) => !range.empty);
    if (ranges.length === 0) {
      return "";
    }
    return ranges.map((range) => view.state.sliceDoc(range.from, range.to)).join("\n");
  };

  const copySelection = async () => {
    const text = getSelectedText();
    if (!text) {
      return false;
    }
    await writeText(text);
    return true;
  };

  const cutSelection = async () => {
    const view = editorView;
    if (!view) {
      return false;
    }
    const copied = await copySelection();
    if (!copied) {
      return false;
    }
    view.dispatch({
      ...view.state.replaceSelection(""),
      userEvent: "delete.cut",
      annotations: [
        Transaction.addToHistory.of(true),
        isolateHistory.of("full")
      ]
    });
    return true;
  };

  const pasteSelection = async () => {
    const view = editorView;
    if (!view) {
      return false;
    }
    const text = await readText();
    if (!text) {
      return false;
    }
    view.dispatch({
      ...view.state.replaceSelection(text),
      userEvent: "input.paste",
      annotations: [
        Transaction.addToHistory.of(true),
        isolateHistory.of("full")
      ]
    });
    return true;
  };

  const undoEdit = () => {
    if (!editorView) {
      return false;
    }
    editorView.focus();
    return undo(editorView);
  };

  const redoEdit = () => {
    if (!editorView) {
      return false;
    }
    editorView.focus();
    return redo(editorView);
  };

  return {
    setHost,
    init,
    destroy,
    focus,
    getText,
    setText,
    applySettings,
    toggleFindPanel,
    toggleReplacePanel,
    cutSelection,
    copySelection,
    pasteSelection,
    undoEdit,
    redoEdit,
    getRevision
  };
};
