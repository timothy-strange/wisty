export type AppErrorCode =
  | "OPEN_FAILED"
  | "SAVE_FAILED"
  | "LAUNCH_OPEN_FAILED"
  | "SETTINGS_LOAD_FAILED"
  | "FONT_PICK_FAILED"
  | "WINDOW_TITLE_FAILED"
  | "CANCELLED"
  | "UNKNOWN";

export type AppError = {
  code: AppErrorCode;
  message: string;
  cause?: unknown;
  details?: Record<string, unknown>;
};

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const isAppError = (value: unknown): value is AppError => {
  if (!isObjectRecord(value)) {
    return false;
  }
  if (typeof value.code !== "string" || typeof value.message !== "string") {
    return false;
  }
  return true;
};

export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  if (typeof error === "string" && error.trim()) {
    return error;
  }
  return "An unknown error occurred";
};

export const toAppError = (
  error: unknown,
  fallbackCode: AppErrorCode,
  fallbackMessage: string,
  details?: Record<string, unknown>
): AppError => {
  if (isAppError(error)) {
    return {
      ...error,
      details: {
        ...(error.details ?? {}),
        ...(details ?? {})
      }
    };
  }

  const normalizedMessage = getErrorMessage(error);
  const message = normalizedMessage === "An unknown error occurred"
    ? fallbackMessage
    : normalizedMessage;

  return {
    code: fallbackCode,
    message,
    cause: error,
    details
  };
};
