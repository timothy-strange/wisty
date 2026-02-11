import type { Accessor } from "solid-js";
import type { FontStyle } from "../settings/settingsTypes";

export type AsyncAction = () => Promise<void>;

export type CloseFlowState = "idle" | "awaiting-discard" | "force-closing";

export type CloseRequestEvent = {
  preventDefault: () => void;
};

export type ErrorReporter = {
  showError: (context: string, error: unknown) => Promise<void>;
};

export type OpenTextFileResult =
  | { kind: "cancelled" }
  | { kind: "opened"; filePath: string; text: string };

export type OpenTextFilePathResult =
  | { kind: "cancelled" }
  | { kind: "opened"; filePath: string };

export type SaveTextFileAsResult =
  | { kind: "cancelled" }
  | { kind: "saved"; filePath: string };

export type TextStreamChunk = {
  text: string;
  bytesReadTotal: number;
  fileSizeBytes?: number;
};

export type StreamReadTextFileOptions = {
  chunkSizeBytes?: number;
};

export type FileLoadPhase = "idle" | "loading" | "cancelling" | "error";

export type FileLoadProgress = {
  elapsedMs: number;
  bytesRead: number;
  totalBytes?: number;
};

export type LaunchFileStreamStartResult = {
  streamId: string;
  filePath: string;
  fileSizeBytes: number;
};

export type LaunchFileStreamChunkResult =
  | { kind: "chunk"; text: string; bytesReadTotal: number; fileSizeBytes: number }
  | { kind: "eof"; bytesReadTotal: number; fileSizeBytes: number };

export type LaunchFileStreamPort = {
  startLaunchFileStream: (filePath: string) => Promise<LaunchFileStreamStartResult>;
  readLaunchFileChunk: (streamId: string, maxBytes: number) => Promise<LaunchFileStreamChunkResult>;
  cancelLaunchFileStream: (streamId: string) => Promise<void>;
  closeLaunchFileStream: (streamId: string) => Promise<void>;
};

export type FileDialogsPort = {
  openTextFile: (defaultPath?: string) => Promise<OpenTextFileResult>;
  openTextFilePath: (defaultPath?: string) => Promise<OpenTextFilePathResult>;
  saveTextFilePathAs: (defaultPath?: string) => Promise<SaveTextFileAsResult>;
};

export type FileIoPort = {
  getFileSize: (filePath: string) => Promise<number>;
  readTextFile: (filePath: string) => Promise<string>;
  streamReadTextFile: (
    filePath: string,
    options?: StreamReadTextFileOptions
  ) => AsyncGenerator<TextStreamChunk, void, void>;
  saveTextFile: (filePath: string, text: string) => Promise<void>;
  getDirectoryFromFilePath: (filePath: string) => string;
};

export type AppendTextOptions = {
  emitChange?: boolean;
  addToHistory?: boolean;
};

export type ResetEditorOptions = {
  emitChange?: boolean;
  addToHistory?: boolean;
};

export type EditorPort = {
  focus: () => void;
  getText: () => string;
  getDocLength: () => number;
  getTextSlice: (from: number, to: number) => string;
  getRevision: () => number;
  setText: (text: string, options?: { emitChange?: boolean }) => void;
  append: (text: string, options?: AppendTextOptions) => void;
  reset: (options?: ResetEditorOptions) => void;
  beginProgrammaticLoad: () => void;
  appendToProgrammaticLoad: (text: string) => void;
  commitProgrammaticLoad: (options?: { emitChange?: boolean }) => void;
  cancelProgrammaticLoad: () => void;
  setLargeLineSafeMode: (enabled: boolean) => void;
  undoEdit: () => boolean;
  redoEdit: () => boolean;
  cutSelection: () => Promise<boolean>;
  copySelection: () => Promise<boolean>;
  pasteSelection: () => Promise<boolean>;
  toggleFindPanel: () => boolean;
  toggleReplacePanel: () => boolean;
  setHost: (node: HTMLDivElement) => void;
  init: () => void;
  destroy: () => void;
  applySettings: () => void;
};

export type DocumentPort = {
  state: {
    filePath: string;
    fileName: string;
    isDirty: boolean;
  };
  setRevision: (revision: number) => void;
  markCleanAt: (revision: number) => void;
  setFilePath: (filePath: string) => void;
  setUntitled: () => void;
};

export type FontSelection = {
  fontFamily: string;
  fontSize: number;
  fontStyle: FontStyle;
  fontWeight: number;
};

export type FontPickerPort = {
  chooseEditorFont: (current: FontSelection) => Promise<FontSelection | null>;
};

export type SettingsPort = {
  state: {
    themeMode: "light" | "dark";
    fontFamily: string;
    fontSize: number;
    fontStyle: FontStyle;
    fontWeight: number;
    textWrapEnabled: boolean;
    lastDirectory: string;
  };
  ready: Accessor<boolean>;
  load: () => Promise<void>;
  actions: {
    setThemeMode: (mode: "light" | "dark") => Promise<void>;
    setFontFamily: (fontFamily: string) => Promise<void>;
    setFontSize: (fontSize: number) => Promise<void>;
    setFontStyle: (fontStyle: FontStyle) => Promise<void>;
    setFontWeight: (fontWeight: number) => Promise<void>;
    setTextWrapEnabled: (enabled: boolean) => Promise<void>;
    setLastDirectory: (path: string) => Promise<void>;
  };
};
