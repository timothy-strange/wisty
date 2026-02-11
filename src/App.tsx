import { createEffect, createSignal } from "solid-js";
import { getVersion } from "@tauri-apps/api/app";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./App.css";
import { AppShell } from "./components/AppShell";
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
import { useErrorModalQueue } from "./core/app/useErrorModalQueue";
import { createDocumentStore } from "./core/document/documentStore";
import { createEditorAdapter } from "./core/editor/editorAdapter";
import {
  getDirectoryFromFilePath,
  getFileSize,
  openTextFile,
  openTextFilePath,
  readTextFileAtPath,
  saveTextFile,
  saveTextFilePathAs,
  streamReadTextFileAtPath
} from "./core/files/fileService";
import { createSettingsStore } from "./core/settings/settingsStore";
import { chooseEditorFont } from "./core/fonts/fontDialog";
import { toAppError } from "./core/errors/appError";
import {
  cancelSaveFileStream,
  finishSaveFileStream,
  startSaveFileStream,
  writeSaveFileChunk
} from "./core/window/saveStreamService";
import {
  cancelLaunchFileStream,
  closeLaunchFileStream,
  readLaunchFileChunk,
  startLaunchFileStream,
  takeLaunchFileArg,
  type LaunchFileArg
} from "./core/window/launchArgService";

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
  const errorModalQueue = useErrorModalQueue();

  let editorHostRef: HTMLDivElement | undefined;

  const editorAdapter = createEditorAdapter({
    getSettings: () => settingsStore.state,
    onDocChanged: ({ revision }) => {
      documentStore.setRevision(revision);
    }
  });

  const errors: ErrorReporter = {
    showError: async (context, error) => {
      const appError = toAppError(error, "UNKNOWN", context, { context });
      errorModalQueue.enqueue({
        title: context,
        message: appError.message,
        code: appError.code,
        details: appError.details
      });
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
      saveTextFilePathAs
    },
    fileIo: {
      getFileSize,
      readTextFile: readTextFileAtPath,
      streamReadTextFile: streamReadTextFileAtPath,
      saveTextFile,
      getDirectoryFromFilePath
    },
    launchFileStream: {
      startLaunchFileStream,
      readLaunchFileChunk,
      cancelLaunchFileStream,
      closeLaunchFileStream
    },
    saveFileStream: {
      startSaveFileStream,
      writeSaveFileChunk,
      finishSaveFileStream,
      cancelSaveFileStream
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

  const dismissErrorModalAndRefocus = () => {
    const hadSingleEntry = errorModalQueue.entries().length <= 1;
    errorModalQueue.dismissCurrent();
    if (!hadSingleEntry) {
      return;
    }
    requestAnimationFrame(() => {
      editorAdapter.focus();
    });
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
  const isInteractionBlocked = () =>
    fileLifecycle.loadingState.isLoading()
    || fileLifecycle.savingState.isSaving()
    || errorModalQueue.open();

  const { handleMenuCommandSelected, handleMenuPanelOpenChange } = useMenuCommandPipeline({
    menuPanelOpen: menuState.menuPanelOpen,
    setMenuPanelOpen: menuState.setMenuPanelOpen,
    setActiveMenuId: menuState.setActiveMenuId,
    commandRegistry,
    focusEditor: () => editorAdapter.focus(),
    isInteractionBlocked
  });

  const shortcutRouter = createShortcutRouter({
    definitions,
    execute: (commandId) => {
      if (isInteractionBlocked()) {
        return Promise.resolve(false);
      }
      return commandRegistry.execute(commandId);
    }
  });

  const { handleGlobalKeydown } = useGlobalKeyRouting({
    fileLoading: fileLifecycle.loadingState.isLoading,
    requestCancelFileLoad: fileLifecycle.requestCancelLoading,
    fileSaving: fileLifecycle.savingState.isSaving,
    requestCancelFileSave: fileLifecycle.requestCancelSaving,
    errorModalOpen: errorModalQueue.open,
    dismissErrorModal: dismissErrorModalAndRefocus,
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
      const appError = toAppError(error, "SETTINGS_LOAD_FAILED", "Unable to load settings");
      errorModalQueue.enqueue({
        title: "Unable to load settings",
        message: appError.message,
        code: appError.code,
        details: appError.details
      });
    },
    takeLaunchFileArg,
    openLaunchFileArg: async (launchFile: LaunchFileArg) => {
      if (launchFile.exists) {
        await fileLifecycle.openLaunchFileAtPath(launchFile.path, launchFile.fileSizeBytes);
        return;
      }
      await fileLifecycle.openMissingFileAtPath(launchFile.path);
    },
    onLaunchFileOpenError: async (error) => {
      const appError = toAppError(error, "LAUNCH_OPEN_FAILED", "Unable to open launch file");
      errorModalQueue.enqueue({
        title: "Unable to open launch file",
        message: appError.message,
        code: appError.code,
        details: appError.details
      });
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
        <AppShell
          setEditorHostRef={(node) => {
            editorHostRef = node;
          }}
          safeModeActive={fileLifecycle.safeModeActive()}
          aboutOpen={aboutOpen()}
          appVersion={appVersion()}
          confirmDiscardOpen={closeFlow.confirmDiscardOpen()}
          onConfirmDiscardCancel={() => void closeFlow.resolveConfirmDiscard(false)}
          onConfirmDiscard={() => void closeFlow.resolveConfirmDiscard(true)}
          onAboutClose={closeAboutDialog}
          onAboutError={(payload) => {
            errorModalQueue.enqueue(payload);
          }}
          largeFileDialog={{
            open: largeFileDialog() !== null,
            kind: largeFileDialog()?.kind ?? "confirm",
            filePath: largeFileDialog()?.filePath ?? "",
            sizeBytes: largeFileDialog()?.sizeBytes ?? 0,
            onCancel: () => {
              const state = largeFileDialog();
              if (state?.kind === "confirm") {
                state.resolve(false);
              }
              closeLargeFileDialog();
            },
            onOpenAnyway: () => {
              const state = largeFileDialog();
              if (state?.kind === "confirm") {
                state.resolve(true);
              }
              closeLargeFileDialog();
            },
            onAcknowledge: () => {
              const state = largeFileDialog();
              if (state?.kind === "blocked") {
                state.resolve();
              }
              closeLargeFileDialog();
            }
          }}
          showTransferHitBlocker={
            (fileLifecycle.loadingState.isLoading() && !fileLifecycle.loadingState.showLoadingOverlay())
            || (fileLifecycle.savingState.isSaving() && !fileLifecycle.savingState.showSavingOverlay())
          }
          loading={{
            overlayOpen: fileLifecycle.loadingState.showLoadingOverlay(),
            filePath: fileLifecycle.loadingState.loadingFilePath(),
            bytesRead: fileLifecycle.loadingState.loadingBytesRead(),
            totalBytes: fileLifecycle.loadingState.loadingTotalBytes(),
            largeLineSafeMode: fileLifecycle.loadingState.loadingLargeLineSafeMode(),
            onCancel: fileLifecycle.requestCancelLoading
          }}
          saving={{
            overlayOpen: fileLifecycle.savingState.showSavingOverlay(),
            filePath: fileLifecycle.savingState.savingFilePath(),
            charsWritten: fileLifecycle.savingState.savingCharsWritten(),
            totalChars: fileLifecycle.savingState.savingTotalChars(),
            onCancel: fileLifecycle.requestCancelSaving
          }}
          errorModal={{
            open: errorModalQueue.open(),
            entry: errorModalQueue.current(),
            onDismiss: dismissErrorModalAndRefocus
          }}
        />
      </MenuProvider>
    </CommandsProvider>
  );
}

export default App;
