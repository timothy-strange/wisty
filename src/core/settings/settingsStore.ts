import { createStore } from "solid-js/store";
import { createSignal } from "solid-js";
import { Store } from "@tauri-apps/plugin-store";
import { AppSettings, DEFAULT_SETTINGS, FontFamily, ThemeMode } from "./settingsTypes";

const SETTINGS_FILE = "settings.json";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const isThemeMode = (value: unknown): value is ThemeMode => value === "light" || value === "dark";

const isFontFamily = (value: unknown): value is FontFamily => value === "sans" || value === "serif" || value === "mono";

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

  const setFontFamily = async (fontFamily: FontFamily) => {
    setState({ fontFamily });
    await saveSetting("fontFamily", fontFamily);
  };

  const setFontSize = async (fontSize: number) => {
    const next = clamp(Math.round(fontSize), 9, 40);
    setState({ fontSize: next });
    await saveSetting("fontSize", next);
  };

  const setTextWrapEnabled = async (enabled: boolean) => {
    setState({ textWrapEnabled: enabled });
    await saveSetting("textWrapEnabled", enabled);
  };

  const setHighlightCurrentLineEnabled = async (enabled: boolean) => {
    setState({ highlightCurrentLineEnabled: enabled });
    await saveSetting("highlightCurrentLineEnabled", enabled);
  };

  const setHighlightSelectionMatchesEnabled = async (enabled: boolean) => {
    setState({ highlightSelectionMatchesEnabled: enabled });
    await saveSetting("highlightSelectionMatchesEnabled", enabled);
  };

  const setFindReplaceFontSize = async (fontSize: number) => {
    const next = clamp(Math.round(fontSize), 9, 28);
    setState({ findReplaceFontSize: next });
    await saveSetting("findReplaceFontSize", next);
  };

  const setLastDirectory = async (lastDirectory: string) => {
    setState({ lastDirectory });
    await saveSetting("lastDirectory", lastDirectory);
  };

  const load = async () => {
    backingStore = await Store.load(SETTINGS_FILE);

    const loadedThemeMode = await backingStore.get("themeMode");
    const loadedFontFamily = await backingStore.get("fontFamily");
    const loadedFontSize = await backingStore.get("fontSize");
    const loadedTextWrapEnabled = await backingStore.get("textWrapEnabled");
    const loadedHighlightCurrentLine = await backingStore.get("highlightCurrentLineEnabled");
    const loadedHighlightMatches = await backingStore.get("highlightSelectionMatchesEnabled");
    const loadedFindReplaceFontSize = await backingStore.get("findReplaceFontSize");
    const loadedLastDirectory = await backingStore.get("lastDirectory");

    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

    setState({
      themeMode: isThemeMode(loadedThemeMode) ? loadedThemeMode : (prefersDark ? "dark" : "light"),
      fontFamily: isFontFamily(loadedFontFamily) ? loadedFontFamily : DEFAULT_SETTINGS.fontFamily,
      fontSize: typeof loadedFontSize === "number" ? clamp(loadedFontSize, 9, 40) : DEFAULT_SETTINGS.fontSize,
      textWrapEnabled: typeof loadedTextWrapEnabled === "boolean" ? loadedTextWrapEnabled : DEFAULT_SETTINGS.textWrapEnabled,
      highlightCurrentLineEnabled: typeof loadedHighlightCurrentLine === "boolean"
        ? loadedHighlightCurrentLine
        : DEFAULT_SETTINGS.highlightCurrentLineEnabled,
      highlightSelectionMatchesEnabled: typeof loadedHighlightMatches === "boolean"
        ? loadedHighlightMatches
        : DEFAULT_SETTINGS.highlightSelectionMatchesEnabled,
      findReplaceFontSize: typeof loadedFindReplaceFontSize === "number"
        ? clamp(loadedFindReplaceFontSize, 9, 28)
        : DEFAULT_SETTINGS.findReplaceFontSize,
      lastDirectory: typeof loadedLastDirectory === "string" ? loadedLastDirectory : DEFAULT_SETTINGS.lastDirectory
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
      setTextWrapEnabled,
      setHighlightCurrentLineEnabled,
      setHighlightSelectionMatchesEnabled,
      setFindReplaceFontSize,
      setLastDirectory
    }
  };
};
