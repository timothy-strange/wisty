# Wisty

Wisty is a lightweight graphical text editor for Linux with a clean, minimal interface focused on plain text editing.

This repository contains the TypeScript rewrite (v2), preserving the original app behavior while improving architecture, maintainability, and long-term reliability.

## What Wisty does

- Open, edit, and save plain text files quickly
- Prompt before destructive actions when there are unsaved changes
- Provide a custom in-window menu for common editor actions
- Support keyboard-first workflows (new/open/save, undo/redo, find/replace, clipboard)
- Persist user preferences (theme, font, wrapping, highlighting, last directory)

Wisty is intentionally simple and responsive. It is not intended to be a full IDE.

## Technology stack

### App framework and runtime

- [Tauri](https://github.com/tauri-apps/tauri)
- [WebKitGTK](https://webkitgtk.org/)
- [GTK](https://www.gtk.org/)

### Frontend and editor

- [SolidJS](https://github.com/solidjs/solid)
- [CodeMirror 6](https://github.com/codemirror/dev)

### Tauri plugins currently used

- [plugin-dialog](https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/dialog)
- [plugin-fs](https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/fs)
- [plugin-store](https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/store)
- [plugin-clipboard-manager](https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/clipboard-manager)
- [plugin-opener](https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/opener)

### Tooling

- [Vite](https://github.com/vitejs/vite)
- [vite-plugin-solid](https://github.com/solidjs/vite-plugin-solid)
- [TypeScript](https://www.typescriptlang.org/)

## Project status

Wisty v2 is under active development. Core editing, file lifecycle, custom menus, and settings persistence are implemented, with ongoing refinement to match and improve on the original app UX.
