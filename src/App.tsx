import { createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { message } from "@tauri-apps/plugin-dialog";
import { info } from "@tauri-apps/plugin-log";
import "./App.css";
import { ConfirmDiscardModal } from "./components/ConfirmDiscardModal";
import { MenuBar } from "./components/MenuBar";
import { StatusBar } from "./components/StatusBar";
import { createCommandRegistry, MenuSection } from "./core/commands/commandRegistry";
import { createDocumentStore } from "./core/document/documentStore";
import { createEditorAdapter } from "./core/editor/editorAdapter";
import { getDirectoryFromFilePath, openTextFile, saveTextFile, saveTextFileAs } from "./core/files/fileService";
import { createSettingsStore } from "./core/settings/settingsStore";
import { chooseEditorFont } from "./core/fonts/fontDialog";
import { FONT_PRESETS } from "./core/settings/settingsTypes";

type CloseFlowState = "idle" | "awaiting-discard" | "force-closing";

const isMac = () => navigator.userAgent.toLowerCase().includes("mac");

const mod = () => (isMac() ? "Cmd" : "Ctrl");

const shortcut = (key: string, withShift = false) => `${mod()}${withShift ? "+Shift" : ""}+${key}`;

function App() {
  const appWindow = getCurrentWindow();
  const documentStore = createDocumentStore();
  const settingsStore = createSettingsStore();

  const [confirmDiscardOpen, setConfirmDiscardOpen] = createSignal(false);
  const [pendingAction, setPendingAction] = createSignal<null | (() => Promise<void>)>(null);
  const [closeFlowState, setCloseFlowState] = createSignal<CloseFlowState>("idle");

  let editorHostRef: HTMLDivElement | undefined;
  let unlistenCloseRequest: (() => void) | undefined;

  const editorAdapter = createEditorAdapter({
    getSettings: () => settingsStore.state,
    onDocChanged: ({ revision }) => {
      documentStore.setRevision(revision);
    }
  });

  const loadEditorTextAsClean = (text: string) => {
    editorAdapter.setText(text, { emitChange: false });
    documentStore.markCleanAt(editorAdapter.getRevision());
  };

  const closeApplicationAction = async () => {
    setCloseFlowState("force-closing");
    await appWindow.close();
  };

  const withErrorMessage = async (action: () => Promise<void>, context: string) => {
    try {
      await action();
    } catch (error) {
      await message(`${context}: ${String(error)}`);
      editorAdapter.focus();
    }
  };

  const openAction = async () => {
    await withErrorMessage(async () => {
      const result = await openTextFile(settingsStore.state.lastDirectory);
      if (result.kind === "cancelled") {
        editorAdapter.focus();
        return;
      }
      loadEditorTextAsClean(result.text);
      documentStore.setFilePath(result.filePath);
      await settingsStore.actions.setLastDirectory(getDirectoryFromFilePath(result.filePath));
      editorAdapter.focus();
    }, "Unable to open file");
  };

  const newAction = async () => {
    loadEditorTextAsClean("");
    documentStore.setUntitled();
    editorAdapter.focus();
  };

  const saveAsAction = async () => {
    await withErrorMessage(async () => {
      const result = await saveTextFileAs(editorAdapter.getText(), settingsStore.state.lastDirectory);
      if (result.kind === "cancelled") {
        editorAdapter.focus();
        return;
      }
      documentStore.setFilePath(result.filePath);
      documentStore.markCleanAt(editorAdapter.getRevision());
      await settingsStore.actions.setLastDirectory(getDirectoryFromFilePath(result.filePath));
      editorAdapter.focus();
    }, "Unable to save file");
  };

  const saveAction = async () => {
    if (!documentStore.state.filePath) {
      await saveAsAction();
      return;
    }

    await withErrorMessage(async () => {
      await saveTextFile(documentStore.state.filePath, editorAdapter.getText());
      documentStore.markCleanAt(editorAdapter.getRevision());
      await settingsStore.actions.setLastDirectory(getDirectoryFromFilePath(documentStore.state.filePath));
      editorAdapter.focus();
    }, "Unable to save file");
  };

  const runOrConfirmDiscard = async (action: () => Promise<void>) => {
    if (!documentStore.state.isDirty) {
      await action();
      return;
    }
    setPendingAction(() => action);
    setConfirmDiscardOpen(true);
  };

  const requestClose = async () => {
    if (!documentStore.state.isDirty) {
      await closeApplicationAction();
      return;
    }
    setPendingAction(() => closeApplicationAction);
    setCloseFlowState("awaiting-discard");
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

    if (!shouldDiscard) {
      if (closeFlowState() === "awaiting-discard") {
        setCloseFlowState("idle");
      }
      editorAdapter.focus();
      return;
    }

    await withErrorMessage(async () => {
      await action();
    }, "Unable to complete action");
  };

  const chooseEditorFontAction = async () => {
    await withErrorMessage(async () => {
      const selection = await chooseEditorFont({
        fontFamily: settingsStore.state.fontFamily,
        fontSize: settingsStore.state.fontSize,
        fontStyle: settingsStore.state.fontStyle,
        fontWeight: settingsStore.state.fontWeight
      });
      if (!selection) {
        return;
      }
      void info(`[wisty] chooseEditorFont selection ${JSON.stringify(selection)}`).catch(() => {
        // ignore logging transport failures
      });
      await settingsStore.actions.setFontFamily(selection.fontFamily);
      await settingsStore.actions.setFontSize(selection.fontSize);
      await settingsStore.actions.setFontStyle(selection.fontStyle);
      await settingsStore.actions.setFontWeight(selection.fontWeight);
    }, "Unable to choose font");
  };

  const commandRegistry = createCommandRegistry([
    { id: "file.new", label: "New", shortcut: shortcut("N"), run: () => runOrConfirmDiscard(newAction) },
    { id: "file.open", label: "Open", shortcut: shortcut("O"), run: () => runOrConfirmDiscard(openAction) },
    { id: "file.save", label: "Save", shortcut: shortcut("S"), run: saveAction },
    { id: "file.saveAs", label: "Save As", shortcut: shortcut("S", true), run: saveAsAction },
    { id: "file.quit", label: "Quit", shortcut: shortcut("Q"), run: requestClose },
    { id: "edit.undo", label: "Undo", shortcut: shortcut("Z"), run: () => { editorAdapter.undoEdit(); } },
    { id: "edit.redo", label: "Redo", shortcut: isMac() ? shortcut("Z", true) : shortcut("Y"), run: () => { editorAdapter.redoEdit(); } },
    { id: "edit.cut", label: "Cut", shortcut: shortcut("X"), run: () => editorAdapter.cutSelection() },
    { id: "edit.copy", label: "Copy", shortcut: shortcut("C"), run: () => editorAdapter.copySelection() },
    { id: "edit.paste", label: "Paste", shortcut: shortcut("V"), run: () => editorAdapter.pasteSelection() },
    { id: "edit.find", label: "Find", shortcut: shortcut("F"), run: () => { editorAdapter.toggleFindPanel(); } },
    { id: "edit.replace", label: "Replace", shortcut: shortcut("H"), run: () => { editorAdapter.toggleReplacePanel(); } },
    {
      id: "view.theme.light",
      label: "Light Theme",
      run: () => settingsStore.actions.setThemeMode("light"),
      checked: () => settingsStore.state.themeMode === "light"
    },
    {
      id: "view.theme.dark",
      label: "Dark Theme",
      run: () => settingsStore.actions.setThemeMode("dark"),
      checked: () => settingsStore.state.themeMode === "dark"
    },
    {
      id: "view.wrap",
      label: "Text Wrap",
      run: () => settingsStore.actions.setTextWrapEnabled(!settingsStore.state.textWrapEnabled),
      checked: () => settingsStore.state.textWrapEnabled
    },
    {
      id: "view.highlight.current",
      label: "Highlight Current Line",
      run: () => settingsStore.actions.setHighlightCurrentLineEnabled(!settingsStore.state.highlightCurrentLineEnabled),
      checked: () => settingsStore.state.highlightCurrentLineEnabled
    },
    {
      id: "view.highlight.matches",
      label: "Highlight Matches",
      run: () => settingsStore.actions.setHighlightSelectionMatchesEnabled(!settingsStore.state.highlightSelectionMatchesEnabled),
      checked: () => settingsStore.state.highlightSelectionMatchesEnabled
    },
    {
      id: "view.font.minus",
      label: "Font Size Down",
      run: () => settingsStore.actions.setFontSize(settingsStore.state.fontSize - 1)
    },
    {
      id: "view.font.plus",
      label: "Font Size Up",
      run: () => settingsStore.actions.setFontSize(settingsStore.state.fontSize + 1)
    },
    {
      id: "view.font.sans",
      label: "Font Sans",
      run: () => settingsStore.actions.setFontFamily(FONT_PRESETS.sans),
      checked: () => settingsStore.state.fontFamily === FONT_PRESETS.sans
    },
    {
      id: "view.font.serif",
      label: "Font Serif",
      run: () => settingsStore.actions.setFontFamily(FONT_PRESETS.serif),
      checked: () => settingsStore.state.fontFamily === FONT_PRESETS.serif
    },
    {
      id: "view.font.mono",
      label: "Font Mono",
      run: () => settingsStore.actions.setFontFamily(FONT_PRESETS.mono),
      checked: () => settingsStore.state.fontFamily === FONT_PRESETS.mono
    },
    {
      id: "view.font.browser",
      label: "Choose Font...",
      run: chooseEditorFontAction
    },
    {
      id: "help.about",
      label: "About Wisty",
      run: () => message("Wisty v2\nTauri + SolidJS + TypeScript")
    }
  ]);

  const menuSections = createMemo<MenuSection[]>(() => ([
    {
      id: "file",
      label: "File",
      items: [
        { type: "command", commandId: "file.new" },
        { type: "command", commandId: "file.open" },
        { type: "separator" },
        { type: "command", commandId: "file.save" },
        { type: "command", commandId: "file.saveAs" },
        { type: "separator" },
        { type: "command", commandId: "file.quit" }
      ]
    },
    {
      id: "edit",
      label: "Edit",
      items: [
        { type: "command", commandId: "edit.undo" },
        { type: "command", commandId: "edit.redo" },
        { type: "separator" },
        { type: "command", commandId: "edit.cut" },
        { type: "command", commandId: "edit.copy" },
        { type: "command", commandId: "edit.paste" },
        { type: "separator" },
        { type: "command", commandId: "edit.find" },
        { type: "command", commandId: "edit.replace" }
      ]
    },
    {
      id: "view",
      label: "View",
      items: [
        { type: "command", commandId: "view.theme.light" },
        { type: "command", commandId: "view.theme.dark" },
        { type: "separator" },
        { type: "command", commandId: "view.wrap" },
        { type: "command", commandId: "view.highlight.current" },
        { type: "command", commandId: "view.highlight.matches" },
        { type: "separator" },
        { type: "command", commandId: "view.font.minus" },
        { type: "command", commandId: "view.font.plus" },
        { type: "command", commandId: "view.font.browser" },
        { type: "separator" },
        { type: "command", commandId: "view.font.sans" },
        { type: "command", commandId: "view.font.serif" },
        { type: "command", commandId: "view.font.mono" }
      ]
    },
    {
      id: "help",
      label: "Help",
      items: [{ type: "command", commandId: "help.about" }]
    }
  ]));

  const handleGlobalKeydown = (event: KeyboardEvent) => {
    const modKey = event.ctrlKey || event.metaKey;

    if (confirmDiscardOpen()) {
      if (event.key === "Escape") {
        event.preventDefault();
        void resolveConfirmDiscard(false);
      }
      return;
    }

    if (modKey && !event.shiftKey && event.key.toLowerCase() === "n") {
      event.preventDefault();
      void commandRegistry.execute("file.new");
      return;
    }
    if (modKey && !event.shiftKey && event.key.toLowerCase() === "o") {
      event.preventDefault();
      void commandRegistry.execute("file.open");
      return;
    }
    if (modKey && !event.shiftKey && event.key.toLowerCase() === "s") {
      event.preventDefault();
      void commandRegistry.execute("file.save");
      return;
    }
    if (modKey && event.shiftKey && event.key.toLowerCase() === "s") {
      event.preventDefault();
      void commandRegistry.execute("file.saveAs");
      return;
    }
    if (modKey && !event.shiftKey && event.key.toLowerCase() === "q") {
      event.preventDefault();
      void commandRegistry.execute("file.quit");
      return;
    }
    if (modKey && !event.shiftKey && event.key.toLowerCase() === "z") {
      event.preventDefault();
      void commandRegistry.execute("edit.undo");
      return;
    }
    if ((modKey && event.shiftKey && event.key.toLowerCase() === "z") || (modKey && !event.shiftKey && event.key.toLowerCase() === "y")) {
      event.preventDefault();
      void commandRegistry.execute("edit.redo");
      return;
    }
    if (modKey && !event.shiftKey && event.key.toLowerCase() === "f") {
      event.preventDefault();
      void commandRegistry.execute("edit.find");
      return;
    }
    if (modKey && !event.shiftKey && event.key.toLowerCase() === "h") {
      event.preventDefault();
      void commandRegistry.execute("edit.replace");
    }
  };

  onMount(() => {
    if (!editorHostRef) {
      return;
    }

    editorAdapter.setHost(editorHostRef);
    editorAdapter.init();
    loadEditorTextAsClean("");
    editorAdapter.focus();

    window.addEventListener("keydown", handleGlobalKeydown);

    void settingsStore.load().then(() => {
      editorAdapter.applySettings();
    }).catch(async (error) => {
      await message(`Unable to load settings: ${String(error)}`);
    });

    void appWindow.onCloseRequested((event) => {
      if (closeFlowState() === "force-closing") {
        setCloseFlowState("idle");
        return;
      }
      if (!documentStore.state.isDirty) {
        return;
      }
      event.preventDefault();
      setPendingAction(() => closeApplicationAction);
      setCloseFlowState("awaiting-discard");
      setConfirmDiscardOpen(true);
    }).then((unlisten) => {
      unlistenCloseRequest = unlisten;
    });
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
    document.documentElement.dataset.theme = settingsStore.state.themeMode;
    settingsStore.state.fontFamily;
    settingsStore.state.fontSize;
    settingsStore.state.fontStyle;
    settingsStore.state.fontWeight;
    settingsStore.state.textWrapEnabled;
    settingsStore.state.highlightCurrentLineEnabled;
    settingsStore.state.highlightSelectionMatchesEnabled;
    settingsStore.state.findReplaceFontSize;
    editorAdapter.applySettings();
  });

  createEffect(() => {
    document.title = `${documentStore.state.isDirty ? "*" : ""}${documentStore.state.fileName} - wisty`;
  });

  return (
    <main class="app-shell">
      <MenuBar sections={menuSections()} registry={commandRegistry} />

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
