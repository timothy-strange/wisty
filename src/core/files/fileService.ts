import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";

export type OpenFileResult =
  | { kind: "cancelled" }
  | { kind: "opened"; filePath: string; text: string };

export type SaveAsResult =
  | { kind: "cancelled" }
  | { kind: "saved"; filePath: string };

const normalizeDialogPath = (value: string | string[] | null): string | null => {
  if (!value) {
    return null;
  }
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value;
};

const directoryFromPath = (filePath: string): string => {
  const normalized = filePath.replace(/\\/g, "/");
  const lastSlash = normalized.lastIndexOf("/");
  return lastSlash <= 0 ? "" : normalized.slice(0, lastSlash);
};

export const openTextFile = async (defaultPath?: string): Promise<OpenFileResult> => {
  const selected = normalizeDialogPath(await open({
    multiple: false,
    defaultPath: defaultPath || undefined
  }));

  if (!selected) {
    return { kind: "cancelled" };
  }

  const text = await readTextFile(selected);
  return {
    kind: "opened",
    filePath: selected,
    text
  };
};

export const saveTextFileAs = async (text: string, defaultPath?: string): Promise<SaveAsResult> => {
  const selected = await save({ defaultPath: defaultPath || undefined });
  if (!selected) {
    return { kind: "cancelled" };
  }
  await writeTextFile(selected, text);
  return {
    kind: "saved",
    filePath: selected
  };
};

export const saveTextFile = async (filePath: string, text: string): Promise<void> => {
  await writeTextFile(filePath, text);
};

export const getDirectoryFromFilePath = (filePath: string): string => directoryFromPath(filePath);
