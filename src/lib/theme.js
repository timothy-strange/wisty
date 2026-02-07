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
  ".cm-activeLine": {
    backgroundColor: "transparent"
  },
  ".cm-activeLineGutter": {
    backgroundColor: "transparent"
  },
  ".cm-gutters": {
    display: "none"
  }
}, { dark: options.themeMode === "dark" });
