import { invoke } from "@tauri-apps/api/core";

export type SetWindowTitleParams = {
  label: string;
  title: string;
};

export type SetWindowTitleResult =
  | { ok: true }
  | { ok: false; reason: string };

const toErrorReason = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

export const setNativeWindowTitle = async (
  params: SetWindowTitleParams
): Promise<SetWindowTitleResult> => {
  try {
    await invoke("set_window_title", params);
    return { ok: true };
  } catch (error) {
    const reason = toErrorReason(error);
    return { ok: false, reason };
  }
};
