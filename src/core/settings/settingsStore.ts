import { createStore } from "solid-js/store";
import { createSignal } from "solid-js";
import { Store } from "@tauri-apps/plugin-store";
import { AppSettings, DEFAULT_SETTINGS, FontStyle, FormatViewMode, ThemeMode } from "./settingsTypes";

const SETTINGS_FILE = "settings.json";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const isThemeMode = (value: unknown): value is ThemeMode => value === "light" || value === "dark";

const isFontStyle = (value: unknown): value is FontStyle => value === "normal" || value === "italic" || value === "oblique";

const isFormatViewMode = (value: unknown): value is FormatViewMode => value === "formatted" || value === "plain";

type SettingKey = keyof AppSettings;

export const createSettingsStore = () => {
  const [state, setState] = createStore<AppSettings>({ ...DEFAULT_SETTINGS });
  const [ready, setReady] = createSignal(false);
  let backingStore: Store | null = null;

  const saveSetting = async <K extends SettingKey>(key: K, value: AppSettings[K]) => {
    if (!ready() || !backingStore) {
      return;
    }
    await backingStore.set(key, value);
    await backingStore.save();
  };

  const setThemeMode = async (themeMode: ThemeMode) => {
    setState({ themeMode });
    await saveSetting("themeMode", themeMode);
  };

  const setFontFamily = async (fontFamily: string) => {
    setState({ fontFamily });
    await saveSetting("fontFamily", fontFamily);
  };

  const setFontSize = async (fontSize: number) => {
    const next = clamp(Math.round(fontSize), 9, 40);
    setState({ fontSize: next });
    await saveSetting("fontSize", next);
  };

  const setFontStyle = async (fontStyle: FontStyle) => {
    setState({ fontStyle });
    await saveSetting("fontStyle", fontStyle);
  };

  const setFontWeight = async (fontWeight: number) => {
    const next = clamp(Math.round(fontWeight), 100, 900);
    setState({ fontWeight: next });
    await saveSetting("fontWeight", next);
  };

  const setTextWrapEnabled = async (enabled: boolean) => {
    setState({ textWrapEnabled: enabled });
    await saveSetting("textWrapEnabled", enabled);
  };

  const setFormatViewMode = async (formatViewMode: FormatViewMode) => {
    setState({ formatViewMode });
    await saveSetting("formatViewMode", formatViewMode);
  };

  const setStatusBarEnabled = async (enabled: boolean) => {
    setState({ statusBarEnabled: enabled });
    await saveSetting("statusBarEnabled", enabled);
  };

  const setSpellCheckEnabled = async (enabled: boolean) => {
    setState({ spellCheckEnabled: enabled });
    await saveSetting("spellCheckEnabled", enabled);
  };

  const setSpellCheckLanguage = async (language: string) => {
    setState({ spellCheckLanguage: language });
    await saveSetting("spellCheckLanguage", language);
  };

  const setLastDirectory = async (lastDirectory: string) => {
    setState({ lastDirectory });
    await saveSetting("lastDirectory", lastDirectory);
  };

  const addRecentFile = async (filePath: string) => {
    const filtered = state.recentFiles.filter((f) => f !== filePath);
    const next = [filePath, ...filtered].slice(0, 3);
    setState({ recentFiles: next });
    await saveSetting("recentFiles", next);
  };

  const setRecentFiles = async (recentFiles: string[]) => {
    const next = recentFiles.slice(0, 3);
    setState({ recentFiles: next });
    await saveSetting("recentFiles", next);
  };

  const removeRecentFile = async (filePath: string) => {
    const next = state.recentFiles.filter((f) => f !== filePath);
    if (next.length === state.recentFiles.length) {
      return;
    }
    setState({ recentFiles: next });
    await saveSetting("recentFiles", next);
  };

  const load = async () => {
    backingStore = await Store.load(SETTINGS_FILE);

    const loadedThemeMode = await backingStore.get("themeMode");
    const loadedFontFamily = await backingStore.get("fontFamily");
    const loadedFontSize = await backingStore.get("fontSize");
    const loadedFontStyle = await backingStore.get("fontStyle");
    const loadedFontWeight = await backingStore.get("fontWeight");
    const loadedTextWrapEnabled = await backingStore.get("textWrapEnabled");
    const loadedFormatViewMode = await backingStore.get("formatViewMode");
    const loadedStatusBarEnabled = await backingStore.get("statusBarEnabled");
    const loadedSpellCheckEnabled = await backingStore.get("spellCheckEnabled");
    const loadedSpellCheckLanguage = await backingStore.get("spellCheckLanguage");
    const loadedLastDirectory = await backingStore.get("lastDirectory");
    const loadedRecentFiles = await backingStore.get("recentFiles");

    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

    setState({
      themeMode: isThemeMode(loadedThemeMode) ? loadedThemeMode : (prefersDark ? "dark" : "light"),
      fontFamily: typeof loadedFontFamily === "string" && loadedFontFamily.trim().length > 0
        ? loadedFontFamily
        : DEFAULT_SETTINGS.fontFamily,
      fontSize: typeof loadedFontSize === "number" ? clamp(loadedFontSize, 9, 40) : DEFAULT_SETTINGS.fontSize,
      fontStyle: isFontStyle(loadedFontStyle) ? loadedFontStyle : DEFAULT_SETTINGS.fontStyle,
      fontWeight: typeof loadedFontWeight === "number" ? clamp(loadedFontWeight, 100, 900) : DEFAULT_SETTINGS.fontWeight,
      textWrapEnabled: typeof loadedTextWrapEnabled === "boolean" ? loadedTextWrapEnabled : DEFAULT_SETTINGS.textWrapEnabled,
      formatViewMode: isFormatViewMode(loadedFormatViewMode) ? loadedFormatViewMode : DEFAULT_SETTINGS.formatViewMode,
      statusBarEnabled: typeof loadedStatusBarEnabled === "boolean"
        ? loadedStatusBarEnabled
        : DEFAULT_SETTINGS.statusBarEnabled,
      spellCheckEnabled: typeof loadedSpellCheckEnabled === "boolean"
        ? loadedSpellCheckEnabled
        : DEFAULT_SETTINGS.spellCheckEnabled,
      spellCheckLanguage: typeof loadedSpellCheckLanguage === "string" && loadedSpellCheckLanguage.trim().length > 0
        ? loadedSpellCheckLanguage
        : DEFAULT_SETTINGS.spellCheckLanguage,
      lastDirectory: typeof loadedLastDirectory === "string" ? loadedLastDirectory : DEFAULT_SETTINGS.lastDirectory,
      recentFiles: Array.isArray(loadedRecentFiles) && loadedRecentFiles.every((f) => typeof f === "string")
        ? (loadedRecentFiles as string[]).slice(0, 3)
        : DEFAULT_SETTINGS.recentFiles
    });

    setReady(true);
  };

  return {
    state,
    ready,
    load,
    actions: {
      setThemeMode,
      setFontFamily,
      setFontSize,
      setFontStyle,
      setFontWeight,
      setTextWrapEnabled,
      setFormatViewMode,
      setStatusBarEnabled,
      setSpellCheckEnabled,
      setSpellCheckLanguage,
      setLastDirectory,
      addRecentFile,
      setRecentFiles,
      removeRecentFile
    }
  };
};
