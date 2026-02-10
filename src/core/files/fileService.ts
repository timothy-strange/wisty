import { open as openDialog, save } from "@tauri-apps/plugin-dialog";
import { open as openFile, readTextFile, stat, writeTextFile } from "@tauri-apps/plugin-fs";

export type OpenFileResult =
  | { kind: "cancelled" }
  | { kind: "opened"; filePath: string; text: string };

export type OpenFilePathResult =
  | { kind: "cancelled" }
  | { kind: "opened"; filePath: string };

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

const DEFAULT_STREAM_CHUNK_BYTES = 256 * 1024;
const MIN_STREAM_CHUNK_BYTES = 4 * 1024;

const normalizeChunkSizeBytes = (chunkSizeBytes?: number): number => {
  if (typeof chunkSizeBytes !== "number" || !Number.isFinite(chunkSizeBytes)) {
    return DEFAULT_STREAM_CHUNK_BYTES;
  }
  const normalized = Math.floor(chunkSizeBytes);
  if (normalized < MIN_STREAM_CHUNK_BYTES) {
    return MIN_STREAM_CHUNK_BYTES;
  }
  return normalized;
};

export const openTextFile = async (defaultPath?: string): Promise<OpenFileResult> => {
  const selectedPath = await openTextFilePath(defaultPath);
  if (selectedPath.kind === "cancelled") {
    return selectedPath;
  }

  const text = await readTextFile(selectedPath.filePath);
  return {
    kind: "opened",
    filePath: selectedPath.filePath,
    text
  };
};

export const openTextFilePath = async (defaultPath?: string): Promise<OpenFilePathResult> => {
  const selected = normalizeDialogPath(await openDialog({
    multiple: false,
    defaultPath: defaultPath || undefined
  }));

  if (!selected) {
    return { kind: "cancelled" };
  }

  return {
    kind: "opened",
    filePath: selected
  };
};

export const saveTextFileAs = async (text: string, defaultPath?: string): Promise<SaveAsResult> => {
  const selected = await saveTextFilePathAs(defaultPath);
  if (selected.kind === "cancelled") {
    return selected;
  }
  await writeTextFile(selected.filePath, text);
  return selected;
};

export const saveTextFilePathAs = async (defaultPath?: string): Promise<SaveAsResult> => {
  const selected = await save({ defaultPath: defaultPath || undefined });
  if (!selected) {
    return { kind: "cancelled" };
  }
  return {
    kind: "saved",
    filePath: selected
  };
};

export const saveTextFile = async (filePath: string, text: string): Promise<void> => {
  await writeTextFile(filePath, text);
};

export const readTextFileAtPath = async (filePath: string): Promise<string> => {
  return readTextFile(filePath);
};

export const streamReadTextFileAtPath = async function* (
  filePath: string,
  options?: { chunkSizeBytes?: number }
): AsyncGenerator<{ text: string; bytesReadTotal: number; fileSizeBytes?: number }, void, void> {
  const fileInfo = await stat(filePath);
  const fileSizeBytes = fileInfo.size;
  const chunkSizeBytes = normalizeChunkSizeBytes(options?.chunkSizeBytes);
  const buffer = new Uint8Array(chunkSizeBytes);
  const decoder = new TextDecoder();

  const handle = await openFile(filePath, { read: true });
  let bytesReadTotal = 0;

  try {
    while (true) {
      const readCount = await handle.read(buffer);
      if (readCount === null || readCount <= 0) {
        break;
      }

      bytesReadTotal += readCount;
      const text = decoder.decode(buffer.subarray(0, readCount), { stream: true });
      if (typeof text !== "string") {
        throw new Error(`Decoder produced non-string chunk for '${filePath}'`);
      }
      if (text) {
        yield {
          text,
          bytesReadTotal,
          fileSizeBytes
        };
      }
    }

    const trailingText = decoder.decode();
    if (typeof trailingText !== "string") {
      throw new Error(`Decoder produced non-string trailing chunk for '${filePath}'`);
    }
    if (trailingText) {
      yield {
        text: trailingText,
        bytesReadTotal,
        fileSizeBytes
      };
    }
  } finally {
    await handle.close();
  }
};

export const getFileSize = async (filePath: string): Promise<number> => {
  const metadata = await stat(filePath);
  return metadata.size;
};

export const getDirectoryFromFilePath = (filePath: string): string => directoryFromPath(filePath);
