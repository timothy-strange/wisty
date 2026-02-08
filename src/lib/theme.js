export const fontFamilyForClass = (value) => {
  if (value === "font-serif") {
    return "Georgia, 'Times New Roman', serif";
  }
  if (value === "font-mono") {
    return "'Ubuntu Mono', 'Fira Mono', 'DejaVu Sans Mono', monospace";
  }
  return "'Cantarell', 'Helvetica Neue', Arial, sans-serif";
};

export const buildEditorTheme = (EditorView, options) => EditorView.theme({
  "&": {
    height: "100%",
    minHeight: "100%",
    backgroundColor: "transparent",
    color: "inherit",
    lineHeight: "1.4",
    outline: "none"
  },
  ".cm-scroller": {
    overflow: "auto",
    fontFamily: fontFamilyForClass(options.textFontClass),
    fontSize: `${options.fontSize}px`
  },
  ".cm-content": {
    padding: "12px",
    fontFamily: fontFamilyForClass(options.textFontClass),
    fontSize: `${options.fontSize}px`
  },
  ".cm-panels": {
    fontSize: `${options.findReplaceFontSize}px`,
    backgroundColor: options.themeMode === "dark" ? "#1f2937" : undefined,
    color: options.themeMode === "dark" ? "#e5e7eb" : undefined,
    borderColor: options.themeMode === "dark" ? "#374151" : undefined
  },
  ".cm-panels-top": {
    borderBottom: options.themeMode === "dark" ? "1px solid #374151" : undefined
  },
  ".cm-panels-bottom": {
    borderTop: options.themeMode === "dark" ? "1px solid #374151" : undefined
  },
  ".cm-search": {
    fontSize: `${options.findReplaceFontSize}px`,
    backgroundColor: options.themeMode === "dark" ? "#1f2937" : undefined,
    color: options.themeMode === "dark" ? "#e5e7eb" : undefined
  },
  ".cm-search label": {
    fontSize: `${options.findReplaceFontSize}px`,
    color: options.themeMode === "dark" ? "#9ca3af" : undefined
  },
  ".cm-search input": {
    fontSize: `${options.findReplaceFontSize}px`,
    backgroundColor: options.themeMode === "dark" ? "#111827" : undefined,
    color: options.themeMode === "dark" ? "#e5e7eb" : undefined,
    border: options.themeMode === "dark" ? "1px solid #4b5563" : undefined
  },
  ".cm-search button": {
    fontSize: `${options.findReplaceFontSize}px`,
    backgroundColor: options.themeMode === "dark" ? "#374151" : "#f3f4f6",
    color: options.themeMode === "dark" ? "#e5e7eb" : "#111827",
    border: options.themeMode === "dark" ? "1px solid #4b5563" : "1px solid #d1d5db",
    backgroundImage: "none",
    boxShadow: "none"
  },
  ".cm-search button:hover": {
    backgroundColor: options.themeMode === "dark" ? "#4b5563" : "#e5e7eb",
    backgroundImage: "none"
  },
  ".cm-search button:active": {
    backgroundColor: options.themeMode === "dark" ? "#6b7280" : "#d1d5db",
    backgroundImage: "none"
  },
  ".cm-search .cm-button": {
    fontSize: `${options.findReplaceFontSize}px`,
    backgroundColor: options.themeMode === "dark" ? "#374151" : "#f3f4f6",
    color: options.themeMode === "dark" ? "#e5e7eb" : "#111827",
    border: options.themeMode === "dark" ? "1px solid #4b5563" : "1px solid #d1d5db",
    backgroundImage: "none",
    boxShadow: "none"
  },
  ".cm-search .cm-button:hover": {
    backgroundColor: options.themeMode === "dark" ? "#4b5563" : "#e5e7eb",
    backgroundImage: "none"
  },
  ".cm-search .cm-button:active": {
    backgroundColor: options.themeMode === "dark" ? "#6b7280" : "#d1d5db",
    backgroundImage: "none"
  },
  ".cm-search .cm-button:disabled": {
    opacity: 0.55,
    backgroundImage: "none"
  },
  ".cm-selectionBackground": {
    background: options.themeMode === "dark" ? "rgba(59,130,246,0.38)" : "rgba(147,197,253,0.55)"
  },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground": {
    background: options.themeMode === "dark" ? "rgba(59,130,246,0.38)" : "rgba(147,197,253,0.55)"
  },
  ".cm-content ::selection": {
    background: options.themeMode === "dark" ? "rgba(59,130,246,0.38)" : "rgba(147,197,253,0.55)"
  },
  ".cm-activeLine": {
    backgroundColor: options.highlightCurrentLineEnabled
      ? (options.themeMode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)")
      : "transparent"
  },
  ".cm-activeLineGutter": {
    backgroundColor: "transparent"
  },
  ".cm-gutters": {
    display: "none"
  }
}, { dark: options.themeMode === "dark" });
