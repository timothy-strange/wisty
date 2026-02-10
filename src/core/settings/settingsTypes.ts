export type ThemeMode = "light" | "dark";

export type FontStyle = "normal" | "italic" | "oblique";

export const FONT_PRESETS = {
  sans: "Noto Sans, Liberation Sans, sans-serif",
  serif: "Noto Serif, Liberation Serif, serif",
  mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace"
} as const;

export type AppSettings = {
  themeMode: ThemeMode;
  fontFamily: string;
  fontSize: number;
  fontStyle: FontStyle;
  fontWeight: number;
  textWrapEnabled: boolean;
  highlightCurrentLineEnabled: boolean;
  lastDirectory: string;
};

export const DEFAULT_SETTINGS: AppSettings = {
  themeMode: "light",
  fontFamily: FONT_PRESETS.mono,
  fontSize: 14,
  fontStyle: "normal",
  fontWeight: 400,
  textWrapEnabled: false,
  highlightCurrentLineEnabled: true,
  lastDirectory: ""
};
