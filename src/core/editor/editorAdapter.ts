import { Compartment, EditorState, Transaction } from "@codemirror/state";
import { defaultKeymap, history, isolateHistory, redo, undo } from "@codemirror/commands";
import { search, searchKeymap } from "@codemirror/search";
import { drawSelection, dropCursor, EditorView, keymap } from "@codemirror/view";
import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
import { AppSettings } from "../settings/settingsTypes";
import { createSearchPanelAdapter } from "./searchPanelAdapter";

type DocChangedPayload = {
  revision: number;
};

type CursorPositionPayload = {
  currentLine: number;
  totalLines: number;
};

type EditorAdapterOptions = {
  onDocChanged: (payload: DocChangedPayload) => void;
  onCursorPositionChanged: (payload: CursorPositionPayload) => void;
  getSettings: () => AppSettings;
};

type SetTextOptions = {
  emitChange?: boolean;
};

type AppendTextOptions = {
  emitChange?: boolean;
  addToHistory?: boolean;
};

type ResetEditorOptions = {
  emitChange?: boolean;
  addToHistory?: boolean;
};

export const createEditorAdapter = (options: EditorAdapterOptions) => {
  let editorHost: HTMLDivElement | undefined;
  let editorView: EditorView | undefined;
  let revision = 0;
  let suppressDocEvents = 0;
  let largeLineSafeModeEnabled = false;
  let lastReportedCurrentLine: number | undefined;
  let lastReportedTotalLines: number | undefined;
  const searchPanelAdapter = createSearchPanelAdapter();

  const wrapCompartment = new Compartment();
  const styleCompartment = new Compartment();

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
      ".cm-selectionBackground": {
        background: isDark ? "rgba(59,130,246,0.38)" : "rgba(147,197,253,0.55)"
      },
      "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground": {
        background: isDark ? "rgba(59,130,246,0.38)" : "rgba(147,197,253,0.55)"
      },
      ".cm-content ::selection": {
        background: isDark ? "rgba(59,130,246,0.38)" : "rgba(147,197,253,0.55)"
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
        "font-family": "var(--font-menu)",
        "font-size": "13px",
        color: isDark ? "#ffffff" : "#000000",
        "background-color": isDark ? "#1f2937" : "#ffffff"
      },
      ".cm-panel.cm-search label": {
        "font-family": "var(--font-menu)",
        "font-size": "13px",
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
        "font-family": "var(--font-menu)",
        "font-size": "13px",
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
        "font-family": "var(--font-menu)",
        "font-size": "13px",
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

  const createEditorState = (doc: string) => {
    const settings = options.getSettings();

    return EditorState.create({
      doc,
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
        wrapCompartment.of(!largeLineSafeModeEnabled && settings.textWrapEnabled ? EditorView.lineWrapping : []),
        styleCompartment.of(createStyleExtension()),
        EditorView.updateListener.of((update) => {
          if (update.docChanged || update.selectionSet) {
            emitCursorPositionIfChanged(update.state);
          }

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
    });
  };

  const emitCursorPositionIfChanged = (state: EditorState) => {
    const currentLine = state.doc.lineAt(state.selection.main.head).number;
    const totalLines = state.doc.lines;

    if (lastReportedCurrentLine === currentLine && lastReportedTotalLines === totalLines) {
      return;
    }

    lastReportedCurrentLine = currentLine;
    lastReportedTotalLines = totalLines;
    options.onCursorPositionChanged({ currentLine, totalLines });
  };

  const dispatchTextChange = (
    changes: { from: number; to: number; insert: string },
    editOptions: { emitChange?: boolean; addToHistory?: boolean }
  ) => {
    if (!editorView) {
      return;
    }

    const emitChange = editOptions.emitChange ?? true;
    const addToHistory = editOptions.addToHistory ?? true;

    if (!emitChange) {
      suppressDocEvents += 1;
    }
    try {
      editorView.dispatch({
        changes,
        annotations: [Transaction.addToHistory.of(addToHistory)]
      });
    } finally {
      if (!emitChange) {
        suppressDocEvents = Math.max(0, suppressDocEvents - 1);
      }
    }
  };

  const setHost = (node: HTMLDivElement) => {
    editorHost = node;
  };

  const init = () => {
    if (!editorHost || editorView) {
      return;
    }

    editorView = new EditorView({
      parent: editorHost,
      state: createEditorState("")
    });

    emitCursorPositionIfChanged(editorView.state);
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

  const getDocLength = () => editorView?.state.doc.length ?? 0;

  const getTextSlice = (from: number, to: number) => {
    if (!editorView) {
      return "";
    }
    const docLength = editorView.state.doc.length;
    const safeFrom = Math.max(0, Math.min(docLength, Math.floor(from)));
    const safeTo = Math.max(safeFrom, Math.min(docLength, Math.floor(to)));
    if (safeFrom === safeTo) {
      return "";
    }
    return editorView.state.doc.sliceString(safeFrom, safeTo);
  };

  const getRevision = () => revision;

  const setText = (text: string, setTextOptions: SetTextOptions = {}) => {
    if (!editorView) {
      return;
    }
    dispatchTextChange({
      from: 0,
      to: editorView.state.doc.length,
      insert: text
    }, {
      emitChange: setTextOptions.emitChange,
      addToHistory: true
    });
  };

  const append = (text: string, appendOptions: AppendTextOptions = {}) => {
    if (!editorView) {
      return;
    }

    if (typeof text !== "string") {
      throw new Error(`Editor append expects string text, received ${typeof text}`);
    }

    if (text.length === 0) {
      return;
    }

    const from = editorView.state.doc.length;
    dispatchTextChange({
      from,
      to: from,
      insert: text
    }, {
      emitChange: appendOptions.emitChange,
      addToHistory: appendOptions.addToHistory ?? false
    });
  };

  const reset = (resetOptions: ResetEditorOptions = {}) => {
    if (!editorView) {
      return;
    }

    const emitChange = resetOptions.emitChange ?? true;
    void resetOptions.addToHistory;

    const nextState = createEditorState("");
    editorView.setState(nextState);
    revision = 0;
    editorView.scrollDOM.scrollTop = 0;
    editorView.scrollDOM.scrollLeft = 0;
    emitCursorPositionIfChanged(editorView.state);

    if (emitChange) {
      options.onDocChanged({ revision });
    }
  };

  const applySettings = () => {
    if (!editorView) {
      return;
    }
    const settings = options.getSettings();
    editorView.dispatch({
      effects: [
        wrapCompartment.reconfigure(!largeLineSafeModeEnabled && settings.textWrapEnabled ? EditorView.lineWrapping : []),
        styleCompartment.reconfigure(createStyleExtension())
      ]
    });
  };

  const setLargeLineSafeMode = (enabled: boolean) => {
    if (largeLineSafeModeEnabled === enabled) {
      return;
    }
    largeLineSafeModeEnabled = enabled;
    applySettings();
  };

  const openOrFocusFindPanel = () => {
    if (!editorView) {
      return false;
    }
    return searchPanelAdapter.openOrFocusFindPanel(editorView);
  };

  const openOrFocusReplacePanel = () => {
    if (!editorView) {
      return false;
    }
    return searchPanelAdapter.openOrFocusReplacePanel(editorView);
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
    getDocLength,
    getTextSlice,
    setText,
    append,
    reset,
    setLargeLineSafeMode,
    applySettings,
    openOrFocusFindPanel,
    openOrFocusReplacePanel,
    cutSelection,
    copySelection,
    pasteSelection,
    undoEdit,
    redoEdit,
    getRevision
  };
};
