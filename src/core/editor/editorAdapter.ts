import { EditorState } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap, redo, undo } from "@codemirror/commands";
import { drawSelection, dropCursor, EditorView, keymap } from "@codemirror/view";

type DocChangedPayload = {
  revision: number;
  characters: number;
};

type EditorAdapterOptions = {
  onDocChanged: (payload: DocChangedPayload) => void;
};

type SetTextOptions = {
  emitChange?: boolean;
};

export const createEditorAdapter = (options: EditorAdapterOptions) => {
  let editorHost: HTMLDivElement | undefined;
  let editorView: EditorView | undefined;
  let revision = 0;
  let suppressDocEvents = 0;

  const theme = EditorView.theme({
    "&": {
      height: "100%",
      "font-family": "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace",
      "font-size": "14px"
    },
    ".cm-scroller": {
      overflow: "auto",
      "line-height": "1.55"
    },
    ".cm-content": {
      padding: "12px 14px",
      "min-height": "100%"
    }
  });

  const setHost = (node: HTMLDivElement) => {
    editorHost = node;
  };

  const init = () => {
    if (!editorHost || editorView) {
      return;
    }

    editorView = new EditorView({
      parent: editorHost,
      state: EditorState.create({
        doc: "",
        extensions: [
          history(),
          drawSelection(),
          dropCursor(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          theme,
          EditorView.updateListener.of((update) => {
            if (!update.docChanged) {
              return;
            }
            revision += 1;
            if (suppressDocEvents > 0) {
              return;
            }
            options.onDocChanged({
              revision,
              characters: update.state.doc.length
            });
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

  const getCharacterCount = () => editorView?.state.doc.length ?? 0;

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
    undoEdit,
    redoEdit,
    getRevision,
    getCharacterCount
  };
};
