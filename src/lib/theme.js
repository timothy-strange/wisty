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
    backgroundColor: "transparent",
    color: "inherit",
    lineHeight: "1.4"
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
  ".cm-selectionBackground": {
    backgroundColor: options.themeMode === "dark" ? "rgba(59,130,246,0.38)" : "rgba(147,197,253,0.55)"
  },
  ".cm-content ::selection": {
    backgroundColor: options.themeMode === "dark" ? "rgba(59,130,246,0.38)" : "rgba(147,197,253,0.55)"
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
