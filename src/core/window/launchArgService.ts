import { invoke } from "@tauri-apps/api/core";

export type LaunchFileArg = {
  path: string;
  exists: boolean;
  fileSizeBytes?: number;
};

export type LaunchFileStreamStartResult = {
  streamId: string;
  filePath: string;
  fileSizeBytes: number;
};

export type LaunchFileStreamChunkResult =
  | { kind: "chunk"; text: string; bytesReadTotal: number; fileSizeBytes: number }
  | { kind: "eof"; bytesReadTotal: number; fileSizeBytes: number };

export const takeLaunchFileArg = async (): Promise<LaunchFileArg | null> => {
  try {
    const value = await invoke<LaunchFileArg | null>("take_launch_file_arg");
    return value ?? null;
  } catch {
    return null;
  }
};

export const startLaunchFileStream = async (filePath: string): Promise<LaunchFileStreamStartResult> => {
  return invoke<LaunchFileStreamStartResult>("start_launch_file_stream", { filePath });
};

export const readLaunchFileChunk = async (
  streamId: string,
  maxBytes: number
): Promise<LaunchFileStreamChunkResult> => {
  return invoke<LaunchFileStreamChunkResult>("read_launch_file_chunk", { streamId, maxBytes });
};

export const cancelLaunchFileStream = async (streamId: string): Promise<void> => {
  await invoke<void>("cancel_launch_file_stream", { streamId });
};

export const closeLaunchFileStream = async (streamId: string): Promise<void> => {
  await invoke<void>("close_launch_file_stream", { streamId });
};
