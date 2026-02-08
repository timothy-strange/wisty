import { createEffect, onCleanup, onMount } from "solid-js";
import { Compartment, EditorState } from "@codemirror/state";
import {
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  keymap
} from "@codemirror/view";
import { highlightSelectionMatches, openSearchPanel, search, searchKeymap } from "@codemirror/search";
import { defaultKeymap, history, historyKeymap, redo, undo } from "@codemirror/commands";
import { ddebug, derror, dinfo, dtrace } from "../../lib/debugLog";
import { buildEditorTheme } from "../../lib/theme";

export default function useEditor(options) {
  let editorHost;
  let editorView;
  const wrapCompartment = new Compartment();
  const themeCompartment = new Compartment();
  const editableCompartment = new Compartment();
  const activeLineCompartment = new Compartment();
  const selectionMatchesCompartment = new Compartment();

  const coreSetup = [
    search(),
    history(),
    drawSelection(),
    dropCursor(),
    EditorState.allowMultipleSelections.of(true),
    keymap.of([
      ...defaultKeymap,
      ...searchKeymap,
      ...historyKeymap
    ])
  ];

  const buildThemeExtension = () => buildEditorTheme(EditorView, {
    textFontClass: options.textFontClass(),
    fontSize: options.fontSize(),
    themeMode: options.themeMode(),
    highlightCurrentLineEnabled: options.highlightCurrentLineEnabled()
  });

  const focusEditor = () => {
    if (editorView) {
      editorView.focus();
      dtrace("editor", "focusEditor");
    }
  };

  const getEditorText = () => (editorView ? editorView.state.doc.toString() : "");

  const setEditorText = (text) => {
    if (!editorView) {
      ddebug("editor", "setEditorText skipped: editor missing");
      return;
    }
    const currentLength = editorView.state.doc.length;
    editorView.dispatch({
      changes: { from: 0, to: currentLength, insert: text }
    });
    dtrace("editor", "setEditorText applied", { length: text.length });
  };

  const openFindPanel = () => {
    if (!editorView) {
      return false;
    }
    const opened = openSearchPanel(editorView);
    if (opened && editorHost) {
      queueMicrotask(() => {
        const searchInput = editorHost.querySelector(".cm-search [name=search]");
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      });
    }
    return opened;
  };

  const openReplacePanel = () => {
    if (!editorView) {
      return false;
    }
    const opened = openSearchPanel(editorView);
    if (opened && editorHost) {
      queueMicrotask(() => {
        const replaceInput = editorHost.querySelector(".cm-search [name=replace]");
        const searchInput = editorHost.querySelector(".cm-search [name=search]");
        const target = replaceInput || searchInput;
        if (target) {
          target.focus();
          target.select();
        }
      });
    }
    return opened;
  };

  const runDocumentCommand = (command) => {
    if (!editorView) {
      return false;
    }
    editorView.focus();
    try {
      return Boolean(document.execCommand(command));
    } catch {
      return false;
    }
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

  const initEditor = () => {
    ddebug("editor", "initEditor called", { hasHost: Boolean(editorHost), hasView: Boolean(editorView) });
    if (!editorHost || editorView) {
      ddebug("editor", "initEditor skipped", { reason: !editorHost ? "missing-host" : "view-exists" });
      return;
    }
    try {
      const editorState = EditorState.create({
        doc: "",
        extensions: [
          coreSetup,
          options.buildKeymap(),
          wrapCompartment.of(options.textWrapEnabled() ? EditorView.lineWrapping : []),
          themeCompartment.of(buildThemeExtension()),
          editableCompartment.of(EditorView.editable.of(!(options.confirmOpen() || options.aboutOpen() || options.menuOpen()))),
          activeLineCompartment.of(options.highlightCurrentLineEnabled() ? highlightActiveLine() : []),
          selectionMatchesCompartment.of(options.highlightSelectionMatchesEnabled() ? highlightSelectionMatches() : []),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              dtrace("editor", "docChanged listener fired", {
                docLength: update.state.doc.length,
                transactions: update.transactions.length
              });
              options.onDocChanged();
            }
          })
        ]
      });
      editorView = new EditorView({
        state: editorState,
        parent: editorHost
      });
      dinfo("editor", "editor initialized successfully");
      options.onDocChanged();
      setTimeout(() => focusEditor(), 0);
    } catch (err) {
      derror("editor", "editor initialization failed", { error: String(err) });
    }
  };

  onMount(() => {
    dinfo("editor", "onMount scheduling init");
    setTimeout(() => initEditor(), 0);
  });

  onCleanup(() => {
    if (editorView) {
      editorView.destroy();
      editorView = null;
      dinfo("editor", "editor destroyed on cleanup");
    }
  });

  createEffect(() => {
    const wrapEnabled = options.textWrapEnabled();
    if (!editorView) {
      return;
    }
    editorView.dispatch({
      effects: wrapCompartment.reconfigure(wrapEnabled ? EditorView.lineWrapping : [])
    });
    dtrace("editor", "wrap mode reconfigured", { enabled: wrapEnabled });
  });

  createEffect(() => {
    options.fontSize();
    options.textFontClass();
    options.themeMode();
    options.highlightCurrentLineEnabled();
    if (!editorView) {
      return;
    }
    editorView.dispatch({
      effects: themeCompartment.reconfigure(buildThemeExtension())
    });
    dtrace("editor", "theme reconfigured", {
      themeMode: options.themeMode(),
      textFontClass: options.textFontClass(),
      fontSize: options.fontSize()
    });
  });

  createEffect(() => {
    const isEditable = !(options.confirmOpen() || options.aboutOpen() || options.menuOpen());
    if (!editorView) {
      return;
    }
    editorView.dispatch({
      effects: editableCompartment.reconfigure(EditorView.editable.of(isEditable))
    });
    dtrace("editor", "editable state reconfigured", { editable: isEditable });
  });

  createEffect(() => {
    const highlightActiveLineEnabled = options.highlightCurrentLineEnabled();
    if (!editorView) {
      return;
    }
    editorView.dispatch({
      effects: activeLineCompartment.reconfigure(highlightActiveLineEnabled ? highlightActiveLine() : [])
    });
    dtrace("editor", "active line highlight reconfigured", { enabled: highlightActiveLineEnabled });
  });

  createEffect(() => {
    const selectionMatchesEnabled = options.highlightSelectionMatchesEnabled();
    if (!editorView) {
      return;
    }
    editorView.dispatch({
      effects: selectionMatchesCompartment.reconfigure(selectionMatchesEnabled ? highlightSelectionMatches() : [])
    });
    dtrace("editor", "selection matches highlight reconfigured", { enabled: selectionMatchesEnabled });
  });

  return {
    setEditorHost: (node) => {
      editorHost = node;
      ddebug("editor", "setEditorHost", { present: Boolean(node) });
    },
    focusEditor,
    getEditorText,
    setEditorText,
    openFindPanel,
    openReplacePanel,
    cutSelection: () => runDocumentCommand("cut"),
    copySelection: () => runDocumentCommand("copy"),
    pasteSelection: () => runDocumentCommand("paste"),
    undoEdit,
    redoEdit
  };
}
