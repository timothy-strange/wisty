import { createEffect, createSignal } from "solid-js";
import { getVersion } from "@tauri-apps/api/app";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { message } from "@tauri-apps/plugin-dialog";
import "./App.css";
import { AboutDialog } from "./components/AboutDialog";
import { ConfirmDiscardModal } from "./components/ConfirmDiscardModal";
import { LargeFileOpenModal } from "./components/LargeFileOpenModal";
import { MenuBar } from "./components/MenuBar";
import { createCommandRegistry } from "./core/commands/commandRegistry";
import { buildCommands } from "./core/commands/buildCommands";
import { createShortcutRouter } from "./core/commands/shortcutRouter";
import type { ErrorReporter } from "./core/app/contracts";
import { CommandsProvider, MenuProvider } from "./core/app/appContexts";
import { useAppLifecycle } from "./core/app/useAppLifecycle";
import { useCloseFlow } from "./core/app/useCloseFlow";
import { useFileLifecycle } from "./core/app/useFileLifecycle";
import { useGlobalKeyRouting } from "./core/app/useGlobalKeyRouting";
import { useMenuCommandPipeline } from "./core/app/useMenuCommandPipeline";
import { useMenuState } from "./core/app/useMenuState";
import { useWindowTitleSync } from "./core/app/useWindowTitleSync";
import { createDocumentStore } from "./core/document/documentStore";
import { createEditorAdapter } from "./core/editor/editorAdapter";
import {
  getDirectoryFromFilePath,
  getFileSize,
  openTextFile,
  openTextFilePath,
  readTextFileAtPath,
  saveTextFile,
  saveTextFileAs
} from "./core/files/fileService";
import { createSettingsStore } from "./core/settings/settingsStore";
import { chooseEditorFont } from "./core/fonts/fontDialog";
import { takeLaunchFileArg, type LaunchFileArg } from "./core/window/launchArgService";

const MAIN_WINDOW_LABEL = "main";
const PLATFORM_IS_MAC = navigator.userAgent.toLowerCase().includes("mac");

type LargeFileDialogState =
  | {
      kind: "confirm";
      filePath: string;
      sizeBytes: number;
      resolve: (value: boolean) => void;
    }
  | {
      kind: "blocked";
      filePath: string;
      sizeBytes: number;
      resolve: () => void;
    };

function App() {
  const appWindow = getCurrentWindow();
  const documentStore = createDocumentStore();
  const settingsStore = createSettingsStore();
  const menuState = useMenuState();
  const [aboutOpen, setAboutOpen] = createSignal(false);
  const [appVersion, setAppVersion] = createSignal("2.0.0");
  const [largeFileDialog, setLargeFileDialog] = createSignal<LargeFileDialogState | null>(null);

  let editorHostRef: HTMLDivElement | undefined;

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

  const closeLargeFileDialog = () => {
    setLargeFileDialog(null);
    editorAdapter.focus();
  };

  const confirmOpenLargeFile = (filePath: string, sizeBytes: number): Promise<boolean> =>
    new Promise((resolve) => {
      setLargeFileDialog({
        kind: "confirm",
        filePath,
        sizeBytes,
        resolve
      });
    });

  const showFileTooLarge = (filePath: string, sizeBytes: number): Promise<void> =>
    new Promise((resolve) => {
      setLargeFileDialog({
        kind: "blocked",
        filePath,
        sizeBytes,
        resolve
      });
    });

  const fileLifecycle = useFileLifecycle({
    editor: editorAdapter,
    document: documentStore,
    settings: settingsStore,
    fileDialogs: {
      openTextFile,
      openTextFilePath,
      saveTextFileAs
    },
    fileIo: {
      getFileSize,
      readTextFile: readTextFileAtPath,
      saveTextFile,
      getDirectoryFromFilePath
    },
    fontPicker: {
      chooseEditorFont
    },
    errors,
    confirmOpenLargeFile,
    showFileTooLarge
  });

  const closeFlow = useCloseFlow({
    isDirty: () => documentStore.state.isDirty,
    closeWindow: () => appWindow.close(),
    focusEditor: () => editorAdapter.focus(),
    errors
  });

  const openAboutDialog = async () => {
    setAboutOpen(true);
  };

  const closeAboutDialog = () => {
    setAboutOpen(false);
    editorAdapter.focus();
  };

  const { definitions, sections } = buildCommands({
    platform: { isMac: PLATFORM_IS_MAC },
    closeFlow,
    fileLifecycle,
    editor: editorAdapter,
    settings: settingsStore,
    showAbout: openAboutDialog
  });

  const commandRegistry = createCommandRegistry(definitions);
  const { handleMenuCommandSelected, handleMenuPanelOpenChange } = useMenuCommandPipeline({
    menuPanelOpen: menuState.menuPanelOpen,
    setMenuPanelOpen: menuState.setMenuPanelOpen,
    setActiveMenuId: menuState.setActiveMenuId,
    commandRegistry,
    focusEditor: () => editorAdapter.focus()
  });

  const shortcutRouter = createShortcutRouter({
    definitions,
    execute: (commandId) => commandRegistry.execute(commandId)
  });

  const { handleGlobalKeydown } = useGlobalKeyRouting({
    aboutOpen,
    confirmDiscardOpen: closeFlow.confirmDiscardOpen,
    resolveConfirmDiscard: closeFlow.resolveConfirmDiscard,
    menuPanelOpen: menuState.menuPanelOpen,
    openMenuByMnemonic: menuState.openByMnemonic,
    dispatchShortcut: (event) => shortcutRouter.dispatch(event)
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

  useAppLifecycle({
    getEditorHost: () => editorHostRef,
    editor: editorAdapter,
    document: documentStore,
    loadSettings: () => settingsStore.load(),
    onSettingsLoadError: async (error) => {
      await message(`Unable to load settings: ${String(error)}`);
    },
    takeLaunchFileArg,
    openLaunchFileArg: async (launchFile: LaunchFileArg) => {
      if (launchFile.exists) {
        if (typeof launchFile.text === "string") {
          await fileLifecycle.openFileFromTextAtPath(launchFile.path, launchFile.text);
          return;
        }
        throw new Error(`Launch payload missing text for existing file: ${launchFile.path}`);
      }
      await fileLifecycle.openMissingFileAtPath(launchFile.path);
    },
    onLaunchFileOpenError: async (error) => {
      await message(`Unable to open launch file: ${String(error)}`);
    },
    loadVersion: () => getVersion(),
    setAppVersion,
    handleGlobalKeydown,
    registerCloseRequested: (handler) => appWindow.onCloseRequested(handler),
    handleWindowCloseRequested: closeFlow.handleWindowCloseRequested
  });

  createEffect(() => {
    document.documentElement.dataset.theme = settingsStore.state.themeMode;
    settingsStore.state.fontFamily;
    settingsStore.state.fontSize;
    settingsStore.state.fontStyle;
    settingsStore.state.fontWeight;
    settingsStore.state.textWrapEnabled;
    settingsStore.state.highlightCurrentLineEnabled;
    editorAdapter.applySettings();
  });

  useWindowTitleSync({
    fileName: () => documentStore.state.fileName,
    isDirty: () => documentStore.state.isDirty,
    windowLabel: MAIN_WINDOW_LABEL
  });

  return (
    <CommandsProvider value={commandsContextValue}>
      <MenuProvider value={menuContextValue}>
        <main class="app-shell">
          <MenuBar />

          <section class="editor-shell">
            <div ref={editorHostRef} class="editor-host" />
          </section>

          <ConfirmDiscardModal
            open={closeFlow.confirmDiscardOpen()}
            onCancel={() => void closeFlow.resolveConfirmDiscard(false)}
            onDiscard={() => void closeFlow.resolveConfirmDiscard(true)}
          />

          <AboutDialog
            open={aboutOpen()}
            version={appVersion()}
            onClose={closeAboutDialog}
          />

          <LargeFileOpenModal
            open={largeFileDialog() !== null}
            kind={largeFileDialog()?.kind ?? "confirm"}
            filePath={largeFileDialog()?.filePath ?? ""}
            sizeBytes={largeFileDialog()?.sizeBytes ?? 0}
            onCancel={() => {
              const state = largeFileDialog();
              if (state?.kind === "confirm") {
                state.resolve(false);
              }
              closeLargeFileDialog();
            }}
            onOpenAnyway={() => {
              const state = largeFileDialog();
              if (state?.kind === "confirm") {
                state.resolve(true);
              }
              closeLargeFileDialog();
            }}
            onAcknowledge={() => {
              const state = largeFileDialog();
              if (state?.kind === "blocked") {
                state.resolve();
              }
              closeLargeFileDialog();
            }}
          />
        </main>
      </MenuProvider>
    </CommandsProvider>
  );
}

export default App;
