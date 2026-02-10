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
};

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
      const result = await deps.fileDialogs.openTextFile(deps.settings.state.lastDirectory);
      if (result.kind === "cancelled") {
        deps.editor.focus();
        return;
      }

      loadEditorTextAsClean(result.text);
      deps.document.setFilePath(result.filePath);
      await deps.settings.actions.setLastDirectory(deps.fileIo.getDirectoryFromFilePath(result.filePath));
      deps.editor.focus();
    }, "Unable to open file");
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
    saveFile,
    saveFileAs,
    chooseEditorFont
  };
};
