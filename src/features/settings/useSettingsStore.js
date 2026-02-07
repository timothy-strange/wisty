import { createEffect, createSignal, onMount } from "solid-js";
import { dirname } from "@tauri-apps/api/path";
import { Store } from "@tauri-apps/plugin-store";
import { ddebug, derror, dinfo, dtrace } from "../../lib/debugLog";

export default function useSettingsStore(options) {
  const [storeReady, setStoreReady] = createSignal(false);
  const [lastDirectory, setLastDirectory] = createSignal("");
  let settingsStore;

  const saveSetting = (key, value) => {
    if (!storeReady() || !settingsStore) {
      return;
    }
    void settingsStore.set(key, value);
    void settingsStore.save();
    dtrace("settings", "persisted setting", { key, value });
  };

  const recordLastDirectory = async (filePath) => {
    if (!filePath) {
      return;
    }
    try {
      const directory = await dirname(filePath);
      setLastDirectory(directory);
      if (settingsStore) {
        await settingsStore.set("lastDirectory", directory);
        await settingsStore.save();
        ddebug("settings", "recorded lastDirectory", { directory });
      }
    } catch {
      // ignore directory lookup failures
      derror("settings", "recordLastDirectory failed", { filePath });
    }
  };

  onMount(() => {
    const initStore = async () => {
      dinfo("settings", "loading settings store");
      settingsStore = await Store.load("settings.json");
      try {
        const storedFontSize = await settingsStore.get("fontSize");
        const storedFontClass = await settingsStore.get("fontFamily");
        const storedStatusBar = await settingsStore.get("statusBarVisible");
        const storedStatusBarStatsVisible = await settingsStore.get("statusBarStatsVisible");
        const storedStatusBarFontSize = await settingsStore.get("statusBarFontSize");
        const storedTextWrap = await settingsStore.get("textWrapEnabled");
        const storedThemeMode = await settingsStore.get("themeMode");
        const storedLastDirectory = await settingsStore.get("lastDirectory");

        if (typeof storedFontSize === "number" && Number.isFinite(storedFontSize)) {
          options.setFontSize(storedFontSize);
          options.setFontSizeInput(String(storedFontSize));
          ddebug("settings", "applied stored fontSize", { storedFontSize });
        }
        if (typeof storedFontClass === "string") {
          options.setTextFontClass(storedFontClass);
          ddebug("settings", "applied stored fontFamily", { storedFontClass });
        }
        if (typeof storedStatusBar === "boolean") {
          options.setStatusBarVisible(storedStatusBar);
          ddebug("settings", "applied stored statusBarVisible", { storedStatusBar });
        }
        if (typeof storedStatusBarStatsVisible === "boolean") {
          options.setStatusBarStatsVisible(storedStatusBarStatsVisible);
          ddebug("settings", "applied stored statusBarStatsVisible", { storedStatusBarStatsVisible });
        }
        if (typeof storedStatusBarFontSize === "number" && Number.isFinite(storedStatusBarFontSize)) {
          const clampedStatusBarFontSize = Math.min(18, Math.max(8, storedStatusBarFontSize));
          options.setStatusBarFontSize(clampedStatusBarFontSize);
          options.setStatusBarFontSizeInput(String(clampedStatusBarFontSize));
          ddebug("settings", "applied stored statusBarFontSize", { storedStatusBarFontSize: clampedStatusBarFontSize });
        }
        if (typeof storedTextWrap === "boolean") {
          options.setTextWrapEnabled(storedTextWrap);
          ddebug("settings", "applied stored textWrapEnabled", { storedTextWrap });
        }
        if (storedThemeMode === "dark" || storedThemeMode === "light") {
          options.applyThemeMode(storedThemeMode);
          ddebug("settings", "applied stored themeMode", { storedThemeMode });
        } else {
          const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
          options.applyThemeMode(prefersDark ? "dark" : "light");
          ddebug("settings", "applied system theme fallback", { prefersDark });
        }
        if (typeof storedLastDirectory === "string") {
          setLastDirectory(storedLastDirectory);
          ddebug("settings", "applied stored lastDirectory", { storedLastDirectory });
        }
      } catch {
        // ignore store read failures
        derror("settings", "failed reading settings store");
      }
      setStoreReady(true);
      dinfo("settings", "settings store ready");
    };

    void initStore();
  });

  createEffect(() => {
    saveSetting("fontSize", options.fontSize());
  });

  createEffect(() => {
    saveSetting("fontFamily", options.textFontClass());
  });

  createEffect(() => {
    saveSetting("statusBarVisible", options.statusBarVisible());
  });

  createEffect(() => {
    saveSetting("statusBarStatsVisible", options.statusBarStatsVisible());
  });

  createEffect(() => {
    saveSetting("statusBarFontSize", options.statusBarFontSize());
  });

  createEffect(() => {
    saveSetting("textWrapEnabled", options.textWrapEnabled());
  });

  createEffect(() => {
    saveSetting("themeMode", options.themeMode());
  });

  return {
    lastDirectory,
    recordLastDirectory
  };
}
