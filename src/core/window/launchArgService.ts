import { invoke } from "@tauri-apps/api/core";

export type LaunchFileArg = {
  path: string;
  exists: boolean;
  text: string | null;
};

export const takeLaunchFileArg = async (): Promise<LaunchFileArg | null> => {
  try {
    const value = await invoke<LaunchFileArg | null>("take_launch_file_arg");
    return value ?? null;
  } catch {
    return null;
  }
};
