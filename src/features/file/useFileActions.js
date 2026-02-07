import { createSignal } from "solid-js";
import { message, open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { ddebug, derror, dinfo } from "../../lib/debugLog";
import { getFileNameFromPath } from "../../lib/path";

export default function useFileActions(options) {
  const [confirmOpen, setConfirmOpen] = createSignal(false);
  let confirmResolve;
  let confirmPromise;
  let pendingConfirmMeta = null;

  const withCloseMeta = (data = {}) => {
    const closeReqId = options.currentCloseRequestId ? options.currentCloseRequestId() : null;
    return { closeReqId, ...data };
  };

  const confirmDiscard = async (meta = {}) => {
    const closeMeta = withCloseMeta(meta);
    if (confirmPromise) {
      ddebug("close", "confirmDiscard reused pending promise", {
        ...closeMeta,
        pendingMeta: pendingConfirmMeta
      });
      return confirmPromise;
    }
    pendingConfirmMeta = closeMeta;
    confirmPromise = new Promise((resolve) => {
      confirmResolve = resolve;
      setConfirmOpen(true);
      dinfo("close", "confirmDiscard opened dialog", {
        ...closeMeta,
        hasResolver: Boolean(confirmResolve)
      });
    });
    ddebug("close", "confirmDiscard created promise", closeMeta);
    return confirmPromise;
  };

  const resolveConfirm = (value, meta = {}) => {
    const closeMeta = withCloseMeta(meta);
    ddebug("close", "resolveConfirm called", {
      ...closeMeta,
      value,
      hasResolver: Boolean(confirmResolve),
      hadPendingPromise: Boolean(confirmPromise),
      pendingMeta: pendingConfirmMeta
    });
    if (confirmResolve) {
      confirmResolve(value);
      ddebug("close", "resolveConfirm invoked resolver", closeMeta);
    }
    confirmResolve = null;
    confirmPromise = null;
    pendingConfirmMeta = null;
    setConfirmOpen(false);
    dinfo("close", "confirmDiscard resolved", { ...closeMeta, value });
  };

  const discardQuery = async (good) => {
    const shouldDiscard = await confirmDiscard({ source: "discard-query" });
    ddebug("close", "discardQuery resolved", withCloseMeta({ shouldDiscard }));
    if (shouldDiscard) {
      await good();
    } else {
      options.focusEditor();
    }
  };

  const clear = () => {
    dinfo("file", "clear editor state");
    options.setStartingState("");
    options.setEditorText("");
    options.setCurrentFilePath("");
    options.setFileName("Untitled");
    options.setTextEdited(false);
    options.updateStatsIfVisible();
  };

  const saveFileAs = () => {
    dinfo("file", "saveFileAs start", { defaultPath: options.lastDirectory() || null });
    return saveDialog({ defaultPath: options.lastDirectory() || undefined }).then((filePath) => {
      ddebug("file", "saveFileAs dialog result", { selected: filePath || null });
      if (!filePath) {
        options.focusEditor();
        return;
      }
      writeTextFile(filePath, options.getEditorText()).then(
        () => {
          dinfo("file", "saveFileAs write success", { filePath });
          options.setFileName(getFileNameFromPath(filePath));
          options.setCurrentFilePath(filePath);
          options.setTextEdited(false);
          options.setStartingState(options.getEditorText());
          void options.recordLastDirectory(filePath);
          options.focusEditor();
        },
        (err) => {
          derror("file", "saveFileAs write failed", { filePath, error: String(err) });
          void message("Error while saving, please try again.").then(options.focusEditor);
        }
      );
    },
    (err) => {
      derror("file", "saveFileAs dialog failed", { error: String(err) });
      void message("Error while saving, please try again.").then(options.focusEditor);
    });
  };

  const saveFile = () => {
    dinfo("file", "saveFile start", { hasPath: options.currentFilePath() !== "" });
    if (options.currentFilePath() !== "") {
      return new Promise((success, failure) => {
        writeTextFile(options.currentFilePath(), options.getEditorText()).then(
          () => {
            dinfo("file", "saveFile write success", { filePath: options.currentFilePath() });
            options.setTextEdited(false);
            options.setStartingState(options.getEditorText());
            void options.recordLastDirectory(options.currentFilePath());
            options.focusEditor();
            success();
          },
          () => {
            derror("file", "saveFile write failed", { filePath: options.currentFilePath() });
            failure();
            void message("Error while saving, please try again.").then(options.focusEditor);
          }
        );
      });
    }
    return saveFileAs();
  };

  const open = () => {
    dinfo("file", "openFile start", { defaultPath: options.lastDirectory() || null });
    return openDialog({ defaultPath: options.lastDirectory() || undefined }).then((filePath) => {
      const resolvedPath = Array.isArray(filePath) ? filePath[0] : filePath;
      ddebug("file", "openFile dialog result", { selected: resolvedPath || null });
      if (!resolvedPath) {
        options.focusEditor();
        return;
      }
      clear();
      readTextFile(resolvedPath).then((text) => {
        dinfo("file", "openFile read success", { resolvedPath, textLength: text.length });
        options.setStartingState(text);
        options.setEditorText(text);
        options.setCurrentFilePath(resolvedPath);
        options.setFileName(getFileNameFromPath(resolvedPath));
        void options.recordLastDirectory(resolvedPath);
        options.updateEditedState();
        options.updateStatsIfVisible();
        options.focusEditor();
      }, (err) => {
        derror("file", "openFile read failed", { resolvedPath, error: String(err) });
        void message("Error while opening file, please try again.").then(options.focusEditor);
      });
    },
    (err) => {
      derror("file", "openFile dialog failed", { error: String(err) });
      void message("Error while opening file, please try again.").then(options.focusEditor);
    });
  };

  const openFile = () => {
    ddebug("file", "openFile action invoked", { textEdited: options.textEdited() });
    if (options.textEdited() === false) {
      open();
    } else {
      ddebug("file", "openFile waiting for discard confirmation");
      void discardQuery(open);
    }
  };

  const newFile = () => {
    ddebug("file", "newFile action invoked", { textEdited: options.textEdited() });
    if (options.textEdited() === false) {
      clear();
      options.focusEditor();
    } else {
      ddebug("file", "newFile waiting for discard confirmation");
      void discardQuery(clear);
    }
  };

  return {
    confirmOpen,
    resolveConfirm,
    confirmDiscard,
    saveFile,
    saveFileAs,
    openFile,
    newFile
  };
}
