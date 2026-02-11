import { invoke } from "@tauri-apps/api/core";
import { toAppError } from "../errors/appError";

export type SetWindowTitleParams = {
  label: string;
  title: string;
};

export type SetWindowTitleResult =
  | { ok: true }
  | { ok: false; reason: string };

const toErrorReason = (error: unknown): string => {
  return toAppError(error, "WINDOW_TITLE_FAILED", "Unable to set window title").message;
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
