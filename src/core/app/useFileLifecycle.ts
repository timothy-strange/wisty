import type {
  DocumentPort,
  EditorPort,
  ErrorReporter,
  FileDialogsPort,
  FileIoPort,
  FontPickerPort,
  SettingsPort
} from "./contracts";
import { createSignal } from "solid-js";
import type { LaunchFileStreamChunkResult } from "../window/launchArgService";

type UseFileLifecycleDeps = {
  editor: Pick<EditorPort, "focus" | "getText" | "setText" | "append" | "reset" | "setLargeLineSafeMode" | "getRevision">;
  document: Pick<DocumentPort, "state" | "setRevision" | "markCleanAt" | "setFilePath" | "setUntitled">;
  settings: Pick<SettingsPort, "state" | "actions">;
  fileDialogs: FileDialogsPort;
  fileIo: FileIoPort;
  launchFileStream: {
    startLaunchFileStream: (filePath: string) => Promise<{ streamId: string; filePath: string; fileSizeBytes: number }>;
    readLaunchFileChunk: (streamId: string, maxBytes: number) => Promise<LaunchFileStreamChunkResult>;
    cancelLaunchFileStream: (streamId: string) => Promise<void>;
    closeLaunchFileStream: (streamId: string) => Promise<void>;
  };
  fontPicker: FontPickerPort;
  errors: ErrorReporter;
  confirmOpenLargeFile: (filePath: string, sizeBytes: number) => Promise<boolean>;
  showFileTooLarge: (filePath: string, sizeBytes: number) => Promise<void>;
};

const SOFT_FILE_LIMIT_BYTES = 50 * 1024 * 1024;
const HARD_FILE_LIMIT_BYTES = 1024 * 1024 * 1024;
const LOADING_OVERLAY_DELAY_MS = 500;
const BATCH_NORMAL_BYTES = 1024 * 1024;
const BATCH_SAFE_MODE_BYTES = 256 * 1024;
const SAFE_MODE_PROBE_BYTES = 8 * 1024 * 1024;
const LAUNCH_STREAM_READ_BYTES = 256 * 1024;

class FileLoadCancelledError extends Error {
  constructor() {
    super("File load cancelled");
    this.name = "FileLoadCancelledError";
  }
}

const isFileLoadCancelledError = (error: unknown): error is FileLoadCancelledError =>
  error instanceof FileLoadCancelledError;

const waitForNextFrame = () => new Promise<void>((resolve) => {
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => resolve());
    return;
  }
  setTimeout(() => resolve(), 0);
});

export const useFileLifecycle = (deps: UseFileLifecycleDeps) => {
  const [isLoading, setIsLoading] = createSignal(false);
  const [showLoadingOverlay, setShowLoadingOverlay] = createSignal(false);
  const [loadingFilePath, setLoadingFilePath] = createSignal("");
  const [loadingBytesRead, setLoadingBytesRead] = createSignal(0);
  const [loadingTotalBytes, setLoadingTotalBytes] = createSignal<number | undefined>(undefined);
  const [loadingLargeLineSafeMode, setLoadingLargeLineSafeMode] = createSignal(false);
  const [safeModeActive, setSafeModeActive] = createSignal(false);
  const [cancelRequested, setCancelRequested] = createSignal(false);

  let activeLoadId = 0;
  let loadingOverlayTimer: ReturnType<typeof setTimeout> | null = null;

  const beginLoadingState = (filePath: string) => {
    activeLoadId += 1;
    const loadId = activeLoadId;
    setIsLoading(true);
    setShowLoadingOverlay(false);
    setLoadingFilePath(filePath);
    setLoadingBytesRead(0);
    setLoadingTotalBytes(undefined);
    setLoadingLargeLineSafeMode(false);
    setCancelRequested(false);
    if (loadingOverlayTimer !== null) {
      clearTimeout(loadingOverlayTimer);
      loadingOverlayTimer = null;
    }
    loadingOverlayTimer = setTimeout(() => {
      if (!isLoading() || activeLoadId !== loadId) {
        return;
      }
      setShowLoadingOverlay(true);
    }, LOADING_OVERLAY_DELAY_MS);
    return loadId;
  };

  const endLoadingState = (loadId: number) => {
    if (activeLoadId !== loadId) {
      return;
    }
    if (loadingOverlayTimer !== null) {
      clearTimeout(loadingOverlayTimer);
      loadingOverlayTimer = null;
    }
    setIsLoading(false);
    setShowLoadingOverlay(false);
    setLoadingFilePath("");
    setLoadingBytesRead(0);
    setLoadingTotalBytes(undefined);
    setLoadingLargeLineSafeMode(false);
    setCancelRequested(false);
  };

  const requestCancelLoading = () => {
    if (!isLoading()) {
      return;
    }
    setCancelRequested(true);
  };

  const applySafeMode = (enabled: boolean) => {
    setSafeModeActive(enabled);
    deps.editor.setLargeLineSafeMode(enabled);
  };

  const runWithErrorMessage = async (action: () => Promise<void>, context: string) => {
    try {
      await action();
    } catch (error) {
      if (isFileLoadCancelledError(error)) {
        deps.editor.focus();
        return;
      }
      await deps.errors.showError(context, error);
      deps.editor.focus();
    }
  };

  const loadEditorTextAsClean = (text: string) => {
    deps.editor.reset({ emitChange: false, addToHistory: false });
    if (text.length > 0) {
      deps.editor.append(text, { emitChange: false, addToHistory: false });
    }
    deps.document.markCleanAt(deps.editor.getRevision());
  };

  const loadEditorFileAsCleanFromChunkSource = async (
    filePath: string,
    chunks: AsyncIterable<{ text: string; bytesReadTotal: number; fileSizeBytes?: number }>,
    expectedTotalBytes?: number
  ) => {
    const loadId = beginLoadingState(filePath);
    let chunkIndex = 0;
    let pendingParts: string[] = [];
    let pendingBytes = 0;
    let targetBatchBytes = BATCH_NORMAL_BYTES;
    let sawNewlineInProbe = false;
    let safeModeEnabledForLoad = false;

    const enableLargeLineSafeMode = () => {
      if (safeModeEnabledForLoad) {
        return;
      }
      safeModeEnabledForLoad = true;
      targetBatchBytes = BATCH_SAFE_MODE_BYTES;
      applySafeMode(true);
      setLoadingLargeLineSafeMode(true);
    };

    const commitPendingBatch = async (reason: "threshold" | "final") => {
      if (pendingBytes <= 0) {
        return;
      }
      if (activeLoadId !== loadId || cancelRequested()) {
        throw new FileLoadCancelledError();
      }

      const batchText = pendingParts.join("");
      pendingParts = [];
      pendingBytes = 0;

      const startedAt = performance.now();
      try {
        deps.editor.append(batchText, { emitChange: false, addToHistory: false });
      } catch (error) {
        throw new Error(
          `Unable to append ${reason} batch at chunk ${chunkIndex}: ${String(error)}`
        );
      }
      const commitDurationMs = performance.now() - startedAt;

      await waitForNextFrame();
      if (commitDurationMs > 24) {
        await waitForNextFrame();
      }
    };

    deps.document.setUntitled();
    deps.document.markCleanAt(0);
    applySafeMode(false);
    if (typeof expectedTotalBytes === "number" && expectedTotalBytes > 0) {
      setLoadingTotalBytes(expectedTotalBytes);
    }
    deps.editor.reset({ emitChange: false, addToHistory: false });

    try {
      for await (const chunk of chunks) {
        if (activeLoadId !== loadId || cancelRequested()) {
          throw new FileLoadCancelledError();
        }

        chunkIndex += 1;

        setLoadingBytesRead(chunk.bytesReadTotal);
        if (typeof chunk.fileSizeBytes === "number") {
          setLoadingTotalBytes(chunk.fileSizeBytes);
        }

        if (!sawNewlineInProbe && chunk.text.includes("\n")) {
          sawNewlineInProbe = true;
        }
        if (!safeModeEnabledForLoad && !sawNewlineInProbe && chunk.bytesReadTotal >= SAFE_MODE_PROBE_BYTES) {
          enableLargeLineSafeMode();
        }

        if (typeof chunk.text !== "string") {
          throw new Error(
            `Invalid streamed chunk ${chunkIndex} at ${chunk.bytesReadTotal} bytes: text is ${typeof chunk.text}`
          );
        }

        if (!chunk.text) {
          continue;
        }

        pendingParts.push(chunk.text);
        pendingBytes += chunk.text.length;

        if (pendingBytes >= targetBatchBytes) {
          await commitPendingBatch("threshold");
        }
      }

      if (activeLoadId !== loadId || cancelRequested()) {
        throw new FileLoadCancelledError();
      }

      await commitPendingBatch("final");
      deps.document.markCleanAt(deps.editor.getRevision());
      if (safeModeEnabledForLoad) {
        applySafeMode(true);
      } else {
        applySafeMode(false);
      }
    } catch (error) {
      deps.document.setUntitled();
      deps.document.setRevision(deps.editor.getRevision());
      if (safeModeEnabledForLoad) {
        applySafeMode(true);
      } else {
        applySafeMode(false);
      }
      throw error;
    } finally {
      endLoadingState(loadId);
    }
  };

  const loadEditorFileAsCleanFromFsStream = async (filePath: string, expectedTotalBytes?: number) => {
    await loadEditorFileAsCleanFromChunkSource(
      filePath,
      deps.fileIo.streamReadTextFile(filePath),
      expectedTotalBytes
    );
  };

  const loadEditorFileAsCleanFromLaunchStream = async (filePath: string, expectedTotalBytes?: number) => {
    const stream = await deps.launchFileStream.startLaunchFileStream(filePath);
    let streamClosed = false;

    const closeStream = async () => {
      if (streamClosed) {
        return;
      }
      streamClosed = true;
      await deps.launchFileStream.closeLaunchFileStream(stream.streamId);
    };

    const chunks = (async function* () {
      while (true) {
        if (cancelRequested()) {
          await deps.launchFileStream.cancelLaunchFileStream(stream.streamId);
          throw new FileLoadCancelledError();
        }

        const next = await deps.launchFileStream.readLaunchFileChunk(
          stream.streamId,
          LAUNCH_STREAM_READ_BYTES
        );

        if (next.kind === "eof") {
          break;
        }

        yield {
          text: next.text,
          bytesReadTotal: next.bytesReadTotal,
          fileSizeBytes: next.fileSizeBytes
        };
      }
    })();

    try {
      await loadEditorFileAsCleanFromChunkSource(filePath, chunks, expectedTotalBytes ?? stream.fileSizeBytes);
    } catch (error) {
      if (isFileLoadCancelledError(error)) {
        try {
          await deps.launchFileStream.cancelLaunchFileStream(stream.streamId);
        } catch {
          // ignore cancellation errors during teardown
        }
      }
      throw error;
    } finally {
      await closeStream();
    }
  };

  const newFile = async () => {
    applySafeMode(false);
    loadEditorTextAsClean("");
    deps.document.setUntitled();
    deps.editor.focus();
  };

  const openFile = async () => {
    await runWithErrorMessage(async () => {
      const selected = await deps.fileDialogs.openTextFilePath(deps.settings.state.lastDirectory);
      if (selected.kind === "cancelled") {
        deps.editor.focus();
        return;
      }

      const fileSize = await deps.fileIo.getFileSize(selected.filePath);
      if (fileSize >= HARD_FILE_LIMIT_BYTES) {
        await deps.showFileTooLarge(selected.filePath, fileSize);
        deps.editor.focus();
        return;
      }

      if (fileSize >= SOFT_FILE_LIMIT_BYTES) {
        const shouldOpen = await deps.confirmOpenLargeFile(selected.filePath, fileSize);
        if (!shouldOpen) {
          deps.editor.focus();
          return;
        }
      }

      await loadEditorFileAsCleanFromFsStream(selected.filePath, fileSize);
      deps.document.setFilePath(selected.filePath);
      await deps.settings.actions.setLastDirectory(deps.fileIo.getDirectoryFromFilePath(selected.filePath));
      deps.editor.focus();
    }, "Unable to open file");
  };

  const openFileAtPath = async (filePath: string) => {
    await runWithErrorMessage(async () => {
      await loadEditorFileAsCleanFromFsStream(filePath);
      deps.document.setFilePath(filePath);
      await deps.settings.actions.setLastDirectory(deps.fileIo.getDirectoryFromFilePath(filePath));
      deps.editor.focus();
    }, "Unable to open file");
  };

  const openLaunchFileAtPath = async (filePath: string, fileSizeBytes?: number) => {
    await runWithErrorMessage(async () => {
      await loadEditorFileAsCleanFromLaunchStream(filePath, fileSizeBytes);
      deps.document.setFilePath(filePath);
      await deps.settings.actions.setLastDirectory(deps.fileIo.getDirectoryFromFilePath(filePath));
      deps.editor.focus();
    }, "Unable to open launch file");
  };

  const openFileFromTextAtPath = async (filePath: string, text: string) => {
    const useLargeLineSafeMode = text.length >= SAFE_MODE_PROBE_BYTES && !text.includes("\n");
    applySafeMode(useLargeLineSafeMode);
    loadEditorTextAsClean(text);
    deps.document.setFilePath(filePath);
    await deps.settings.actions.setLastDirectory(deps.fileIo.getDirectoryFromFilePath(filePath));
    deps.editor.focus();
  };

  const openMissingFileAtPath = async (filePath: string) => {
    applySafeMode(false);
    loadEditorTextAsClean("");
    deps.document.setFilePath(filePath);
    await deps.settings.actions.setLastDirectory(deps.fileIo.getDirectoryFromFilePath(filePath));
    deps.editor.focus();
  };

  const saveFileAs = async () => {
    await runWithErrorMessage(async () => {
      const result = await deps.fileDialogs.saveTextFileAs(deps.editor.getText(), deps.settings.state.lastDirectory);
      if (result.kind === "cancelled") {
        deps.editor.focus();
        return;
      }

      deps.document.setFilePath(result.filePath);
      deps.document.markCleanAt(deps.editor.getRevision());
      await deps.settings.actions.setLastDirectory(deps.fileIo.getDirectoryFromFilePath(result.filePath));
      deps.editor.focus();
    }, "Unable to save file");
  };

  const saveFile = async () => {
    if (!deps.document.state.filePath) {
      await saveFileAs();
      return;
    }

    await runWithErrorMessage(async () => {
      await deps.fileIo.saveTextFile(deps.document.state.filePath, deps.editor.getText());
      deps.document.markCleanAt(deps.editor.getRevision());
      await deps.settings.actions.setLastDirectory(deps.fileIo.getDirectoryFromFilePath(deps.document.state.filePath));
      deps.editor.focus();
    }, "Unable to save file");
  };

  const chooseEditorFont = async () => {
    await runWithErrorMessage(async () => {
      const selection = await deps.fontPicker.chooseEditorFont({
        fontFamily: deps.settings.state.fontFamily,
        fontSize: deps.settings.state.fontSize,
        fontStyle: deps.settings.state.fontStyle,
        fontWeight: deps.settings.state.fontWeight
      });

      if (!selection) {
        return;
      }

      await deps.settings.actions.setFontFamily(selection.fontFamily);
      await deps.settings.actions.setFontSize(selection.fontSize);
      await deps.settings.actions.setFontStyle(selection.fontStyle);
      await deps.settings.actions.setFontWeight(selection.fontWeight);
    }, "Unable to choose font");
  };

  return {
    newFile,
    openFile,
    openFileAtPath,
    openLaunchFileAtPath,
    openFileFromTextAtPath,
    openMissingFileAtPath,
    saveFile,
    saveFileAs,
    chooseEditorFont,
    requestCancelLoading,
    loadingState: {
      isLoading,
      showLoadingOverlay,
      loadingFilePath,
      loadingBytesRead,
      loadingTotalBytes,
      loadingLargeLineSafeMode
    },
    safeModeActive
  };
};
