# Wisty

Wisty is a lightweight graphical text editor for Linux with a clean, modern look, intended for plain text editing. It is NOT intended for coding.

It is a fork of [Parchment](https://github.com/tywil04/parchment).

![wisty light](images/wisty-light.png)
![wisty dark](images/wisty-dark.png)

I made wisty (or rather, got an AI to make it) because I wasn't happy with the visual style of any of the lightweight text editors out there. Also, I don't want a supposedly simple text editor which has extensive coding features. I just want an app where I can quickly and easily look at text documents or paste text temporarily, that looks good and opens quickly.

## Build and run

From the project root:

```bash
npm run tauri dev
```

Build Linux release artifacts:

```bash
npm run tauri build
```

## Linux system libraries

For Linux, wisty depends on GTK/WebKitGTK runtime libraries. On Ubuntu 24.04, install:

```bash
sudo apt install -y libgtk-3-0 libwebkit2gtk-4.1-0 libayatana-appindicator3-1 librsvg2-2
```

If you are building wisty from source (not just running a packaged build), you will typically also need development packages:

```bash
sudo apt install -y build-essential pkg-config libssl-dev libgtk-3-dev libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev
```

## Open source libraries used

### App framework and runtime

- [Tauri](https://github.com/tauri-apps/tauri)
- [WebKitGTK](https://webkitgtk.org/)
- [GTK](https://www.gtk.org/)

### Tauri plugins

- [plugin-dialog](https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/dialog)
- [plugin-fs](https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/fs)
- [plugin-shell](https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/shell)
- [plugin-store](https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/store)
- [plugin-os](https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/os)
- [plugin-log](https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/log)
- [plugin-clipboard-manager](https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/clipboard-manager)

### Frontend and editor

- [SolidJS](https://github.com/solidjs/solid)
- [CodeMirror 6](https://github.com/codemirror/dev)

### Tooling

- [Vite](https://github.com/vitejs/vite)
- [vite-plugin-solid](https://github.com/solidjs/vite-plugin-solid)
- [Tailwind CSS](https://github.com/tailwindlabs/tailwindcss)
- [PostCSS](https://github.com/postcss/postcss)
- [Autoprefixer](https://github.com/postcss/autoprefixer)

## Credits

- Original project: [Parchment](https://github.com/tywil04/parchment)
