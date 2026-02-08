import { createEffect, createSignal, onCleanup, onMount } from "solid-js";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { message } from "@tauri-apps/plugin-dialog";
import "./App.css";
import { ConfirmDiscardModal } from "./components/ConfirmDiscardModal";
import { StatusBar } from "./components/StatusBar";
import { createDocumentStore } from "./core/document/documentStore";
import { createEditorAdapter } from "./core/editor/editorAdapter";
import { getDirectoryFromFilePath, openTextFile, saveTextFile, saveTextFileAs } from "./core/files/fileService";

function App() {
  type CloseFlowState = "idle" | "awaiting-discard" | "force-closing";

  const appWindow = getCurrentWindow();
  const documentStore = createDocumentStore();
  const [confirmDiscardOpen, setConfirmDiscardOpen] = createSignal(false);
  const [lastDirectory, setLastDirectory] = createSignal("");
  const [pendingAction, setPendingAction] = createSignal<null | (() => Promise<void>)>(null);
  const [closeFlowState, setCloseFlowState] = createSignal<CloseFlowState>("idle");
  let editorHostRef: HTMLDivElement | undefined;
  let unlistenCloseRequest: (() => void) | undefined;

  const editorAdapter = createEditorAdapter({
    onDocChanged: ({ revision }) => {
      documentStore.setRevision(revision);
    }
  });

  const loadEditorTextAsClean = (text: string) => {
    editorAdapter.setText(text, { emitChange: false });
    const revision = editorAdapter.getRevision();
    documentStore.markCleanAt(revision);
  };

  const openAction = async () => {
    try {
      const result = await openTextFile(lastDirectory());
      if (result.kind === "cancelled") {
        editorAdapter.focus();
        return;
      }
      loadEditorTextAsClean(result.text);
      documentStore.setFilePath(result.filePath);
      setLastDirectory(getDirectoryFromFilePath(result.filePath));
      editorAdapter.focus();
    } catch (error) {
      await message(`Unable to open file. ${String(error)}`);
      editorAdapter.focus();
    }
  };

  const newAction = async () => {
    loadEditorTextAsClean("");
    documentStore.setUntitled();
    editorAdapter.focus();
  };

  const saveAsAction = async () => {
    const text = editorAdapter.getText();
    try {
      const result = await saveTextFileAs(text, lastDirectory());
      if (result.kind === "cancelled") {
        editorAdapter.focus();
        return;
      }
      documentStore.setFilePath(result.filePath);
      documentStore.markCleanAt(editorAdapter.getRevision());
      setLastDirectory(getDirectoryFromFilePath(result.filePath));
      editorAdapter.focus();
    } catch (error) {
      await message(`Unable to save file. ${String(error)}`);
      editorAdapter.focus();
    }
  };

  const saveAction = async () => {
    const text = editorAdapter.getText();
    if (!documentStore.state.filePath) {
      await saveAsAction();
      return;
    }
    try {
      await saveTextFile(documentStore.state.filePath, text);
      documentStore.markCleanAt(editorAdapter.getRevision());
      setLastDirectory(getDirectoryFromFilePath(documentStore.state.filePath));
      editorAdapter.focus();
    } catch (error) {
      await message(`Unable to save file. ${String(error)}`);
      editorAdapter.focus();
    }
  };

  const runOrConfirmDiscard = async (action: () => Promise<void>) => {
    if (!documentStore.state.isDirty) {
      await action();
      return;
    }
    setPendingAction(() => action);
    setConfirmDiscardOpen(true);
  };

  const resolveConfirmDiscard = async (shouldDiscard: boolean) => {
    setConfirmDiscardOpen(false);
    const action = pendingAction();
    setPendingAction(null);
    if (!action) {
      if (closeFlowState() === "awaiting-discard") {
        setCloseFlowState("idle");
      }
      editorAdapter.focus();
      return;
    }
    if (shouldDiscard) {
      try {
        await action();
      } catch (error) {
        if (closeFlowState() !== "idle") {
          setCloseFlowState("idle");
        }
        await message(`Unable to complete action. ${String(error)}`);
        editorAdapter.focus();
      }
      return;
    }
    if (closeFlowState() === "awaiting-discard") {
      setCloseFlowState("idle");
    }
    editorAdapter.focus();
  };

  const handleGlobalKeydown = (event: KeyboardEvent) => {
    const isMod = event.ctrlKey || event.metaKey;
    if (confirmDiscardOpen()) {
      if (event.key === "Escape") {
        event.preventDefault();
        void resolveConfirmDiscard(false);
      }
      return;
    }

    if (isMod && !event.shiftKey && event.key.toLowerCase() === "n") {
      event.preventDefault();
      void runOrConfirmDiscard(newAction);
      return;
    }

    if (isMod && !event.shiftKey && event.key.toLowerCase() === "o") {
      event.preventDefault();
      void runOrConfirmDiscard(openAction);
      return;
    }

    if (isMod && !event.shiftKey && event.key.toLowerCase() === "s") {
      event.preventDefault();
      void saveAction();
      return;
    }

    if (isMod && event.shiftKey && event.key.toLowerCase() === "s") {
      event.preventDefault();
      void saveAsAction();
      return;
    }

    if (isMod && !event.shiftKey && event.key.toLowerCase() === "z") {
      event.preventDefault();
      editorAdapter.undoEdit();
      return;
    }

    if ((isMod && event.shiftKey && event.key.toLowerCase() === "z") || (isMod && !event.shiftKey && event.key.toLowerCase() === "y")) {
      event.preventDefault();
      editorAdapter.redoEdit();
    }
  };

  onMount(() => {
    if (!editorHostRef) {
      return;
    }
    editorAdapter.setHost(editorHostRef);
    editorAdapter.init();
    loadEditorTextAsClean("");
    window.addEventListener("keydown", handleGlobalKeydown);
    void appWindow.onCloseRequested((event) => {
      if (closeFlowState() === "force-closing") {
        setCloseFlowState("idle");
        return;
      }
      if (!documentStore.state.isDirty) {
        return;
      }
      event.preventDefault();
      setPendingAction(() => async () => {
        setCloseFlowState("force-closing");
        await appWindow.close();
      });
      setCloseFlowState("awaiting-discard");
      setConfirmDiscardOpen(true);
    }).then((unlisten) => {
      unlistenCloseRequest = unlisten;
    });
    editorAdapter.focus();
  });

  onCleanup(() => {
    window.removeEventListener("keydown", handleGlobalKeydown);
    if (unlistenCloseRequest) {
      unlistenCloseRequest();
      unlistenCloseRequest = undefined;
    }
    editorAdapter.destroy();
  });

  createEffect(() => {
    document.title = `${documentStore.state.isDirty ? "*" : ""}${documentStore.state.fileName} - wisty`;
  });

  return (
    <main class="app-shell">
      <header class="toolbar">
        <div class="toolbar-left">
          <button class="button" onClick={() => void runOrConfirmDiscard(newAction)}>New</button>
          <button class="button" onClick={() => void runOrConfirmDiscard(openAction)}>Open</button>
          <button class="button" onClick={() => void saveAction()}>Save</button>
          <button class="button" onClick={() => void saveAsAction()}>Save As</button>
        </div>
        <div class="toolbar-right">
          <span class="shortcut-hint">Ctrl/Cmd+N O S Shift+S</span>
        </div>
      </header>

      <section class="editor-shell">
        <div ref={editorHostRef} class="editor-host" />
      </section>

      <StatusBar
        filePath={documentStore.state.filePath}
        fileName={documentStore.state.fileName}
        isDirty={documentStore.state.isDirty}
      />

      <ConfirmDiscardModal
        open={confirmDiscardOpen()}
        onCancel={() => void resolveConfirmDiscard(false)}
        onDiscard={() => void resolveConfirmDiscard(true)}
      />
    </main>
  );
}

export default App;
