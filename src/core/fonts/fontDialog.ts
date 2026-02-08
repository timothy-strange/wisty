import { invoke } from "@tauri-apps/api/core";

export type EditorFontSelection = {
  fontFamily: string;
  fontSize: number;
  fontStyle: "normal" | "italic" | "oblique";
  fontWeight: number;
};

export type EditorFontInput = {
  fontFamily: string;
  fontSize: number;
  fontStyle: "normal" | "italic" | "oblique";
  fontWeight: number;
};

type RawEditorFontSelection = {
  fontFamily?: unknown;
  font_family?: unknown;
  fontSize?: unknown;
  font_size?: unknown;
  fontStyle?: unknown;
  font_style?: unknown;
  fontWeight?: unknown;
  font_weight?: unknown;
};

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const normalizeStyle = (value: unknown): EditorFontSelection["fontStyle"] => {
  if (value === "italic" || value === "oblique") {
    return value;
  }
  return "normal";
};

const parseSelection = (raw: RawEditorFontSelection): EditorFontSelection => {
  const fontFamily = typeof raw.fontFamily === "string"
    ? raw.fontFamily
    : (typeof raw.font_family === "string" ? raw.font_family : "");

  if (!fontFamily.trim()) {
    throw new Error(`Invalid font selection: missing font family (${JSON.stringify(raw)})`);
  }

  const parsedSize = toNumber(raw.fontSize ?? raw.font_size);
  const parsedWeight = toNumber(raw.fontWeight ?? raw.font_weight);

  if (parsedSize === null || parsedWeight === null) {
    throw new Error(`Invalid font selection: missing numeric size/weight (${JSON.stringify(raw)})`);
  }

  return {
    fontFamily: fontFamily.trim(),
    fontSize: Math.min(40, Math.max(9, Math.round(parsedSize))),
    fontStyle: normalizeStyle(raw.fontStyle ?? raw.font_style),
    fontWeight: Math.min(900, Math.max(100, Math.round(parsedWeight)))
  };
};

export const chooseEditorFont = async (current: EditorFontInput): Promise<EditorFontSelection | null> => {
  const rawResult = await invoke<RawEditorFontSelection | null>("choose_editor_font", { current });
  if (!rawResult) {
    return null;
  }
  return parseSelection(rawResult);
};
