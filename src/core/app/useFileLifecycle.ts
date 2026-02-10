import type {
  DocumentPort,
  EditorPort,
  ErrorReporter,
  FileDialogsPort,
  FileIoPort,
  FontPickerPort,
  SettingsPort
} from "./contracts";

type UseFileLifecycleDeps = {
  editor: Pick<EditorPort, "focus" | "getText" | "setText" | "getRevision">;
  document: Pick<DocumentPort, "state" | "markCleanAt" | "setFilePath" | "setUntitled">;
  settings: Pick<SettingsPort, "state" | "actions">;
  fileDialogs: FileDialogsPort;
  fileIo: FileIoPort;
  fontPicker: FontPickerPort;
  errors: ErrorReporter;
  confirmOpenLargeFile: (filePath: string, sizeBytes: number) => Promise<boolean>;
  showFileTooLarge: (filePath: string, sizeBytes: number) => Promise<void>;
};

const SOFT_FILE_LIMIT_BYTES = 50 * 1024 * 1024;
const HARD_FILE_LIMIT_BYTES = 1024 * 1024 * 1024;

export const useFileLifecycle = (deps: UseFileLifecycleDeps) => {
  const runWithErrorMessage = async (action: () => Promise<void>, context: string) => {
    try {
      await action();
    } catch (error) {
      await deps.errors.showError(context, error);
      deps.editor.focus();
    }
  };

  const loadEditorTextAsClean = (text: string) => {
    deps.editor.setText(text, { emitChange: false });
    deps.document.markCleanAt(deps.editor.getRevision());
  };

  const newFile = async () => {
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

      const text = await deps.fileIo.readTextFile(selected.filePath);

      loadEditorTextAsClean(text);
      deps.document.setFilePath(selected.filePath);
      await deps.settings.actions.setLastDirectory(deps.fileIo.getDirectoryFromFilePath(selected.filePath));
      deps.editor.focus();
    }, "Unable to open file");
  };

  const openFileAtPath = async (filePath: string) => {
    await runWithErrorMessage(async () => {
      const text = await deps.fileIo.readTextFile(filePath);
      loadEditorTextAsClean(text);
      deps.document.setFilePath(filePath);
      await deps.settings.actions.setLastDirectory(deps.fileIo.getDirectoryFromFilePath(filePath));
      deps.editor.focus();
    }, "Unable to open file");
  };

  const openFileFromTextAtPath = async (filePath: string, text: string) => {
    loadEditorTextAsClean(text);
    deps.document.setFilePath(filePath);
    await deps.settings.actions.setLastDirectory(deps.fileIo.getDirectoryFromFilePath(filePath));
    deps.editor.focus();
  };

  const openMissingFileAtPath = async (filePath: string) => {
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
    openFileFromTextAtPath,
    openMissingFileAtPath,
    saveFile,
    saveFileAs,
    chooseEditorFont
  };
};
