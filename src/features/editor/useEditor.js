import { createEffect, onCleanup, onMount } from "solid-js";
import { Compartment, EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { ddebug, derror, dinfo, dtrace } from "../../lib/debugLog";
import { buildEditorTheme } from "../../lib/theme";

export default function useEditor(options) {
  let editorHost;
  let editorView;
  const wrapCompartment = new Compartment();
  const themeCompartment = new Compartment();
  const editableCompartment = new Compartment();

  const buildThemeExtension = () => buildEditorTheme(EditorView, {
    textFontClass: options.textFontClass(),
    fontSize: options.fontSize(),
    themeMode: options.themeMode()
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
          basicSetup,
          options.buildKeymap(),
          wrapCompartment.of(options.textWrapEnabled() ? EditorView.lineWrapping : []),
          themeCompartment.of(buildThemeExtension()),
          editableCompartment.of(EditorView.editable.of(!(options.confirmOpen() || options.aboutOpen() || options.menuOpen()))),
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
    if (!editorView) {
      return;
    }
    editorView.dispatch({
      effects: wrapCompartment.reconfigure(options.textWrapEnabled() ? EditorView.lineWrapping : [])
    });
    dtrace("editor", "wrap mode reconfigured", { enabled: options.textWrapEnabled() });
  });

  createEffect(() => {
    options.fontSize();
    options.textFontClass();
    options.themeMode();
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
    if (!editorView) {
      return;
    }
    editorView.dispatch({
      effects: editableCompartment.reconfigure(EditorView.editable.of(!(options.confirmOpen() || options.aboutOpen() || options.menuOpen())))
    });
    dtrace("editor", "editable state reconfigured", { editable: !(options.confirmOpen() || options.aboutOpen() || options.menuOpen()) });
  });

  return {
    setEditorHost: (node) => {
      editorHost = node;
      ddebug("editor", "setEditorHost", { present: Boolean(node) });
    },
    focusEditor,
    getEditorText,
    setEditorText
  };
}
