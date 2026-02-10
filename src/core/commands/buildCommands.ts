import type { CommandDefinition, MenuSection } from "./commandRegistry";

type BuildCommandsDeps = {
  platform: {
    isMac: boolean;
  };
  closeFlow: {
    runOrConfirmDiscard: (action: () => Promise<void>) => Promise<void>;
    requestClose: () => Promise<void>;
  };
  fileLifecycle: {
    newFile: () => Promise<void>;
    openFile: () => Promise<void>;
    saveFile: () => Promise<void>;
    saveFileAs: () => Promise<void>;
    chooseEditorFont: () => Promise<void>;
  };
  editor: {
    undoEdit: () => boolean;
    redoEdit: () => boolean;
    cutSelection: () => Promise<boolean>;
    copySelection: () => Promise<boolean>;
    pasteSelection: () => Promise<boolean>;
    toggleFindPanel: () => boolean;
    toggleReplacePanel: () => boolean;
  };
  settings: {
    state: {
      themeMode: "light" | "dark";
      textWrapEnabled: boolean;
      highlightCurrentLineEnabled: boolean;
    };
    actions: {
      setThemeMode: (mode: "light" | "dark") => Promise<void>;
      setTextWrapEnabled: (enabled: boolean) => Promise<void>;
      setHighlightCurrentLineEnabled: (enabled: boolean) => Promise<void>;
    };
  };
  showAbout: () => Promise<void>;
};

const commandShortcut = (isMac: boolean, key: string, withShift = false) => `${isMac ? "Cmd" : "Ctrl"}${withShift ? "+Shift" : ""}+${key}`;

export const buildCommands = (deps: BuildCommandsDeps): { definitions: CommandDefinition[]; sections: MenuSection[] } => {
  const definitions: CommandDefinition[] = [
    {
      id: "file.new",
      label: "New",
      shortcut: commandShortcut(deps.platform.isMac, "N"),
      run: () => deps.closeFlow.runOrConfirmDiscard(deps.fileLifecycle.newFile)
    },
    {
      id: "file.open",
      label: "Open",
      shortcut: commandShortcut(deps.platform.isMac, "O"),
      run: () => deps.closeFlow.runOrConfirmDiscard(deps.fileLifecycle.openFile)
    },
    {
      id: "file.save",
      label: "Save",
      shortcut: commandShortcut(deps.platform.isMac, "S"),
      run: deps.fileLifecycle.saveFile
    },
    {
      id: "file.saveAs",
      label: "Save As",
      shortcut: commandShortcut(deps.platform.isMac, "S", true),
      run: deps.fileLifecycle.saveFileAs
    },
    {
      id: "file.quit",
      label: "Quit",
      shortcut: commandShortcut(deps.platform.isMac, "Q"),
      run: deps.closeFlow.requestClose
    },
    {
      id: "edit.undo",
      label: "Undo",
      shortcut: commandShortcut(deps.platform.isMac, "Z"),
      refocusEditorOnMenuSelect: true,
      run: () => {
        deps.editor.undoEdit();
      }
    },
    {
      id: "edit.redo",
      label: "Redo",
      shortcut: deps.platform.isMac ? commandShortcut(true, "Z", true) : commandShortcut(false, "Y"),
      refocusEditorOnMenuSelect: true,
      run: () => {
        deps.editor.redoEdit();
      }
    },
    {
      id: "edit.cut",
      label: "Cut",
      shortcut: commandShortcut(deps.platform.isMac, "X"),
      refocusEditorOnMenuSelect: true,
      run: async () => {
        await deps.editor.cutSelection();
      }
    },
    {
      id: "edit.copy",
      label: "Copy",
      shortcut: commandShortcut(deps.platform.isMac, "C"),
      refocusEditorOnMenuSelect: true,
      run: async () => {
        await deps.editor.copySelection();
      }
    },
    {
      id: "edit.paste",
      label: "Paste",
      shortcut: commandShortcut(deps.platform.isMac, "V"),
      refocusEditorOnMenuSelect: true,
      run: async () => {
        await deps.editor.pasteSelection();
      }
    },
    {
      id: "edit.find",
      label: "Find...",
      shortcut: commandShortcut(deps.platform.isMac, "F"),
      run: () => {
        deps.editor.toggleFindPanel();
      }
    },
    {
      id: "edit.find.altReplaceKey",
      label: "Find...",
      shortcut: commandShortcut(deps.platform.isMac, "H"),
      run: () => {
        deps.editor.toggleFindPanel();
      }
    },
    {
      id: "view.theme.light",
      label: "Light Theme",
      refocusEditorOnMenuSelect: true,
      run: () => deps.settings.actions.setThemeMode("light"),
      checked: () => deps.settings.state.themeMode === "light"
    },
    {
      id: "view.theme.dark",
      label: "Dark Theme",
      refocusEditorOnMenuSelect: true,
      run: () => deps.settings.actions.setThemeMode("dark"),
      checked: () => deps.settings.state.themeMode === "dark"
    },
    {
      id: "view.wrap",
      label: "Text Wrap",
      refocusEditorOnMenuSelect: true,
      run: () => deps.settings.actions.setTextWrapEnabled(!deps.settings.state.textWrapEnabled),
      checked: () => deps.settings.state.textWrapEnabled
    },
    {
      id: "view.highlight.current",
      label: "Highlight Current Line",
      refocusEditorOnMenuSelect: true,
      run: () => deps.settings.actions.setHighlightCurrentLineEnabled(!deps.settings.state.highlightCurrentLineEnabled),
      checked: () => deps.settings.state.highlightCurrentLineEnabled
    },
    {
      id: "view.font.browser",
      label: "Font...",
      run: deps.fileLifecycle.chooseEditorFont
    },
    {
      id: "help.about",
      label: "About Wisty",
      run: deps.showAbout
    }
  ];

  const sections: MenuSection[] = [
    {
      id: "file",
      label: "File",
      items: [
        { type: "command", commandId: "file.new" },
        { type: "command", commandId: "file.open" },
        { type: "separator" },
        { type: "command", commandId: "file.save" },
        { type: "command", commandId: "file.saveAs" },
        { type: "separator" },
        { type: "command", commandId: "file.quit" }
      ]
    },
    {
      id: "edit",
      label: "Edit",
      items: [
        { type: "command", commandId: "edit.undo" },
        { type: "command", commandId: "edit.redo" },
        { type: "separator" },
        { type: "command", commandId: "edit.cut" },
        { type: "command", commandId: "edit.copy" },
        { type: "command", commandId: "edit.paste" },
        { type: "separator" },
        { type: "command", commandId: "edit.find" }
      ]
    },
    {
      id: "view",
      label: "View",
      items: [
        { type: "command", commandId: "view.theme.light" },
        { type: "command", commandId: "view.theme.dark" },
        { type: "separator" },
        { type: "command", commandId: "view.wrap" },
        { type: "command", commandId: "view.highlight.current" },
        { type: "separator" },
        { type: "command", commandId: "view.font.browser" }
      ]
    },
    {
      id: "help",
      label: "Help",
      items: [{ type: "command", commandId: "help.about" }]
    }
  ];

  return { definitions, sections };
};
