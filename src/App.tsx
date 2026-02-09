import { createEffect, createSignal, onCleanup, onMount } from "solid-js";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { message } from "@tauri-apps/plugin-dialog";
import { info } from "@tauri-apps/plugin-log";
import "./App.css";
import { ConfirmDiscardModal } from "./components/ConfirmDiscardModal";
import { MenuBar } from "./components/MenuBar";
import { StatusBar } from "./components/StatusBar";
import { createCommandRegistry } from "./core/commands/commandRegistry";
import { buildCommands } from "./core/commands/buildCommands";
import { createShortcutRouter } from "./core/commands/shortcutRouter";
import type { ErrorReporter } from "./core/app/contracts";
import { CommandsProvider, MenuProvider } from "./core/app/appContexts";
import { useCloseFlow } from "./core/app/useCloseFlow";
import { useFileLifecycle } from "./core/app/useFileLifecycle";
import { useMenuState } from "./core/app/useMenuState";
import { createDocumentStore } from "./core/document/documentStore";
import { createEditorAdapter } from "./core/editor/editorAdapter";
import { getDirectoryFromFilePath, openTextFile, saveTextFile, saveTextFileAs } from "./core/files/fileService";
import { createSettingsStore } from "./core/settings/settingsStore";
import { chooseEditorFont } from "./core/fonts/fontDialog";

const isMac = () => navigator.userAgent.toLowerCase().includes("mac");

function App() {
  const appWindow = getCurrentWindow();
  const documentStore = createDocumentStore();
  const settingsStore = createSettingsStore();
  const menuState = useMenuState();

  let editorHostRef: HTMLDivElement | undefined;
  let unlistenCloseRequest: (() => void) | undefined;
  let pendingMenuCommandFrame = 0;

  const editorAdapter = createEditorAdapter({
    getSettings: () => settingsStore.state,
    onDocChanged: ({ revision }) => {
      documentStore.setRevision(revision);
    }
  });

  const errors: ErrorReporter = {
    showError: async (context, error) => {
      await message(`${context}: ${String(error)}`);
    }
  };

  const fileLifecycle = useFileLifecycle({
    editor: editorAdapter,
    document: documentStore,
    settings: settingsStore,
    fileDialogs: {
      openTextFile,
      saveTextFileAs
    },
    fileIo: {
      saveTextFile,
      getDirectoryFromFilePath
    },
    fontPicker: {
      chooseEditorFont
    },
    errors,
    logInfo: info
  });

  const closeFlow = useCloseFlow({
    isDirty: () => documentStore.state.isDirty,
    closeWindow: () => appWindow.close(),
    focusEditor: () => editorAdapter.focus(),
    errors
  });

  const { definitions, sections } = buildCommands({
    platform: { isMac: isMac() },
    closeFlow,
    fileLifecycle,
    editor: editorAdapter,
    settings: settingsStore,
    showAbout: async () => {
      await message("Wisty v2\nTauri + SolidJS + TypeScript");
    }
  });

  const commandRegistry = createCommandRegistry(definitions);
  const [pendingMenuCommandId, setPendingMenuCommandId] = createSignal<string | null>(null);

  const executePendingMenuCommand = async () => {
    const commandId = pendingMenuCommandId();
    if (!commandId) {
      return;
    }

    setPendingMenuCommandId(null);
    const command = commandRegistry.get(commandId);
    const executed = await commandRegistry.execute(commandId);
    if (!executed) {
      return;
    }

    if (command?.refocusEditorOnMenuSelect) {
      editorAdapter.focus();
    }
  };

  const schedulePendingMenuCommandExecution = () => {
    if (!pendingMenuCommandId()) {
      return;
    }
    if (pendingMenuCommandFrame !== 0) {
      return;
    }
    pendingMenuCommandFrame = requestAnimationFrame(() => {
      pendingMenuCommandFrame = 0;
      void executePendingMenuCommand();
    });
  };

  const handleMenuCommandSelected = (commandId: string) => {
    setPendingMenuCommandId(commandId);
    menuState.setActiveMenuId(null);
    menuState.setMenuPanelOpen(false);
  };

  const handleMenuPanelOpenChange = (nextOpen: boolean) => {
    const wasOpen = menuState.menuPanelOpen();
    menuState.setMenuPanelOpen(nextOpen);
    if (!nextOpen) {
      menuState.setActiveMenuId(null);
    }
    if (wasOpen && !nextOpen) {
      schedulePendingMenuCommandExecution();
    }
  };

  createEffect(() => {
    const pending = pendingMenuCommandId();
    if (!pending) {
      return;
    }
    if (menuState.menuPanelOpen()) {
      return;
    }
    schedulePendingMenuCommandExecution();
  });

  const shortcutRouter = createShortcutRouter({
    definitions,
    execute: (commandId) => commandRegistry.execute(commandId)
  });

  const commandsContextValue = {
    sections,
    registry: commandRegistry
  };

  const menuContextValue = {
    activeMenuId: menuState.activeMenuId,
    onActiveMenuIdChange: menuState.setActiveMenuId,
    menuPanelOpen: menuState.menuPanelOpen,
    onMenuPanelOpenChange: handleMenuPanelOpenChange,
    onMenuCommandSelected: handleMenuCommandSelected,
    onRequestEditorFocus: () => editorAdapter.focus()
  };

  const handleGlobalKeydown = (event: KeyboardEvent) => {
    if (closeFlow.confirmDiscardOpen()) {
      if (event.key === "Escape") {
        event.preventDefault();
        void closeFlow.resolveConfirmDiscard(false);
      }
      return;
    }

    if (event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
      if (menuState.openByMnemonic(event.key)) {
        event.preventDefault();
        return;
      }
    }

    if (menuState.menuPanelOpen()) {
      return;
    }

    shortcutRouter.dispatch(event);
  };

  onMount(() => {
    if (!editorHostRef) {
      return;
    }

    editorAdapter.setHost(editorHostRef);
    editorAdapter.init();
    editorAdapter.setText("", { emitChange: false });
    documentStore.markCleanAt(editorAdapter.getRevision());
    editorAdapter.focus();

    window.addEventListener("keydown", handleGlobalKeydown);

    void settingsStore.load().then(() => {
      editorAdapter.applySettings();
    }).catch(async (error) => {
      await message(`Unable to load settings: ${String(error)}`);
    });

    void appWindow.onCloseRequested((event) => {
      closeFlow.handleWindowCloseRequested(event);
    }).then((unlisten) => {
      unlistenCloseRequest = unlisten;
    });
  });

  onCleanup(() => {
    window.removeEventListener("keydown", handleGlobalKeydown);
    if (pendingMenuCommandFrame !== 0) {
      cancelAnimationFrame(pendingMenuCommandFrame);
      pendingMenuCommandFrame = 0;
    }
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
    <CommandsProvider value={commandsContextValue}>
      <MenuProvider value={menuContextValue}>
        <main class="app-shell">
          <MenuBar />

          <section class="editor-shell">
            <div ref={editorHostRef} class="editor-host" />
          </section>

          <StatusBar
            filePath={documentStore.state.filePath}
            fileName={documentStore.state.fileName}
            isDirty={documentStore.state.isDirty}
          />

          <ConfirmDiscardModal
            open={closeFlow.confirmDiscardOpen()}
            onCancel={() => void closeFlow.resolveConfirmDiscard(false)}
            onDiscard={() => void closeFlow.resolveConfirmDiscard(true)}
          />
        </main>
      </MenuProvider>
    </CommandsProvider>
  );
}

export default App;
