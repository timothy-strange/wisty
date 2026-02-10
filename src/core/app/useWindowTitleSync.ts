import { createEffect, type Accessor } from "solid-js";
import { setNativeWindowTitle } from "../window/windowTitleService";

type UseWindowTitleSyncOptions = {
  fileName: Accessor<string>;
  isDirty: Accessor<boolean>;
  windowLabel?: string;
};

const DEFAULT_WINDOW_LABEL = "main";

export const formatWindowTitle = (fileName: string, isDirty: boolean): string => {
  const baseName = fileName || "Untitled";
  return `${isDirty ? "*" : ""}${baseName}`;
};

export const useWindowTitleSync = (options: UseWindowTitleSyncOptions) => {
  const windowLabel = options.windowLabel ?? DEFAULT_WINDOW_LABEL;
  let lastTitle = "";

  createEffect(() => {
    const nextTitle = formatWindowTitle(options.fileName(), options.isDirty());
    if (nextTitle === lastTitle) {
      return;
    }

    lastTitle = nextTitle;
    document.title = nextTitle;

    void setNativeWindowTitle({
      label: windowLabel,
      title: nextTitle
    });
  });
};
