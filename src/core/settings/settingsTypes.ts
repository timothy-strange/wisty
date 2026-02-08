export type ThemeMode = "light" | "dark";

export type FontFamily = "sans" | "serif" | "mono";

export type AppSettings = {
  themeMode: ThemeMode;
  fontFamily: FontFamily;
  fontSize: number;
  textWrapEnabled: boolean;
  highlightCurrentLineEnabled: boolean;
  highlightSelectionMatchesEnabled: boolean;
  findReplaceFontSize: number;
  lastDirectory: string;
};

export const DEFAULT_SETTINGS: AppSettings = {
  themeMode: "light",
  fontFamily: "mono",
  fontSize: 14,
  textWrapEnabled: false,
  highlightCurrentLineEnabled: true,
  highlightSelectionMatchesEnabled: true,
  findReplaceFontSize: 13,
  lastDirectory: ""
};
