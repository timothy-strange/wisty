import { Compartment, EditorState } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap, redo, undo } from "@codemirror/commands";
import { closeSearchPanel, highlightSelectionMatches, openSearchPanel, search, searchKeymap, searchPanelOpen } from "@codemirror/search";
import { drawSelection, dropCursor, EditorView, highlightActiveLine, keymap } from "@codemirror/view";
import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
import { AppSettings } from "../settings/settingsTypes";

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

const fontFamilyMap: Record<AppSettings["fontFamily"], string> = {
  sans: "Noto Sans, Liberation Sans, sans-serif",
  serif: "Noto Serif, Liberation Serif, serif",
  mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace"
};

export const createEditorAdapter = (options: EditorAdapterOptions) => {
  let editorHost: HTMLDivElement | undefined;
  let editorView: EditorView | undefined;
  let revision = 0;
  let suppressDocEvents = 0;

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
        "font-family": fontFamilyMap[settings.fontFamily],
        "font-size": `${settings.fontSize}px`
      },
      ".cm-content": {
        padding: "12px 14px",
        "min-height": "100%",
        "font-family": fontFamilyMap[settings.fontFamily],
        caretColor: isDark ? "#8cb2ff" : "#2451c5"
      },
      ".cm-gutters": {
        "background-color": isDark ? "#111925" : "#ffffff",
        color: isDark ? "#4f657f" : "#9aacbf",
        border: "none"
      },
      ".cm-scroller": {
        overflow: "auto",
        "font-family": fontFamilyMap[settings.fontFamily],
        "line-height": "1.55"
      },
      ".cm-activeLine": {
        background: isDark ? "rgba(124, 152, 202, 0.14)" : "rgba(194, 214, 246, 0.34)"
      },
      ".cm-selectionBackground, .cm-content ::selection": {
        background: isDark ? "rgba(90, 132, 211, 0.45)" : "rgba(133, 171, 238, 0.45)"
      },
      ".cm-panels.cm-panels-top": {
        border: "none",
        padding: "8px",
        "background-color": isDark ? "#182436" : "#f4f8ff"
      },
      ".cm-search": {
        "font-size": `${settings.findReplaceFontSize}px`
      },
      ".cm-search input": {
        border: isDark ? "1px solid #3c4f68" : "1px solid #b7c8e7",
        padding: "3px 6px",
        "border-radius": "6px",
        color: isDark ? "#d7dfef" : "#1c2736",
        "background-color": isDark ? "#0e1724" : "#ffffff"
      },
      ".cm-button": {
        border: isDark ? "1px solid #3c4f68" : "1px solid #b7c8e7",
        "border-radius": "6px",
        padding: "3px 7px",
        color: isDark ? "#d7dfef" : "#1c2736",
        "background-color": isDark ? "#1d2b3f" : "#edf3ff"
      }
    });
  };

  const setHost = (node: HTMLDivElement) => {
    editorHost = node;
  };

  const init = () => {
    if (!editorHost || editorView) {
      return;
    }

    const settings = options.getSettings();

    editorView = new EditorView({
      parent: editorHost,
      state: EditorState.create({
        doc: "",
        extensions: [
          search(),
          history(),
          drawSelection(),
          dropCursor(),
          keymap.of([
            ...defaultKeymap,
            ...historyKeymap,
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
    if (searchPanelOpen(editorView.state)) {
      return closeSearchPanel(editorView);
    }
    const opened = openSearchPanel(editorView);
    if (opened) {
      queueMicrotask(() => {
        const searchInput = editorHost?.querySelector<HTMLInputElement>(".cm-search [name=search]");
        searchInput?.focus();
        searchInput?.select();
      });
    }
    return opened;
  };

  const toggleReplacePanel = () => {
    if (!editorView) {
      return false;
    }
    if (searchPanelOpen(editorView.state)) {
      return closeSearchPanel(editorView);
    }
    const opened = openSearchPanel(editorView);
    if (opened) {
      queueMicrotask(() => {
        const replaceInput = editorHost?.querySelector<HTMLInputElement>(".cm-search [name=replace]");
        const searchInput = editorHost?.querySelector<HTMLInputElement>(".cm-search [name=search]");
        const target = replaceInput ?? searchInput;
        target?.focus();
        target?.select();
      });
    }
    return opened;
  };

  const getSelectedText = () => {
    if (!editorView) {
      return "";
    }
    const ranges = editorView.state.selection.ranges.filter((range) => !range.empty);
    if (ranges.length === 0) {
      return "";
    }
    return ranges.map((range) => editorView.state.sliceDoc(range.from, range.to)).join("\n");
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
    if (!editorView) {
      return false;
    }
    const copied = await copySelection();
    if (!copied) {
      return false;
    }
    editorView.dispatch(editorView.state.replaceSelection(""));
    return true;
  };

  const pasteSelection = async () => {
    if (!editorView) {
      return false;
    }
    const text = await readText();
    if (!text) {
      return false;
    }
    editorView.dispatch(editorView.state.replaceSelection(text));
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
