import { For, Show, createEffect } from "solid-js";
import { open as openInDefault } from "@tauri-apps/plugin-shell";
import { colouredButton, headerTextColour, minimalButton } from "../../constants/ui";

const openSourceLibraries = [
  { name: "Tauri", url: "https://github.com/tauri-apps/tauri" },
  { name: "Tauri JS API", url: "https://github.com/tauri-apps/tauri" },
  { name: "Tauri Plugin Dialog", url: "https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/dialog" },
  { name: "Tauri Plugin Filesystem", url: "https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/fs" },
  { name: "Tauri Plugin Shell", url: "https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/shell" },
  { name: "Tauri Plugin Store", url: "https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/store" },
  { name: "Tauri Plugin OS", url: "https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/os" },
  { name: "Tauri Plugin Log", url: "https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/log" },
  { name: "SolidJS", url: "https://github.com/solidjs/solid" },
  { name: "CodeMirror 6", url: "https://github.com/codemirror/dev" },
  { name: "Vite", url: "https://github.com/vitejs/vite" },
  { name: "vite-plugin-solid", url: "https://github.com/solidjs/vite-plugin-solid" },
  { name: "Tailwind CSS", url: "https://github.com/tailwindlabs/tailwindcss" },
  { name: "PostCSS", url: "https://github.com/postcss/postcss" },
  { name: "Autoprefixer", url: "https://github.com/postcss/autoprefixer" },
  { name: "WebKitGTK", url: "https://webkitgtk.org/" },
  { name: "GTK", url: "https://www.gtk.org/" },
  { name: "Parchment (original project)", url: "https://github.com/tywil04/parchment" }
];

export default function AboutDialog(props) {
  let closeButtonRef;
  let dialogRef;

  const getFocusableButtons = () => {
    if (!dialogRef) {
      return [];
    }
    return Array.from(dialogRef.querySelectorAll("button:not([disabled])"));
  };

  createEffect(() => {
    if (props.open) {
      queueMicrotask(() => {
        if (closeButtonRef) {
          closeButtonRef.focus();
        }
      });
    }
  });

  return (
    <Show when={props.open}>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={props.onClose}>
        <div
          role="dialog"
          aria-modal="true"
          ref={dialogRef}
          className="w-[560px] max-w-[92vw] max-h-[80vh] overflow-hidden rounded border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-800"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              props.onClose();
              return;
            }
            if (event.key !== "Tab") {
              return;
            }
            const focusables = getFocusableButtons();
            if (focusables.length === 0) {
              return;
            }
            const active = document.activeElement;
            const currentIndex = focusables.indexOf(active);
            let nextIndex = 0;
            if (event.shiftKey) {
              nextIndex = currentIndex <= 0 ? focusables.length - 1 : currentIndex - 1;
            } else {
              nextIndex = currentIndex === -1 || currentIndex >= focusables.length - 1 ? 0 : currentIndex + 1;
            }
            event.preventDefault();
            focusables[nextIndex].focus();
          }}
        >
          <div className="flex flex-row items-start">
            <div className="mr-auto">
              <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">wisty</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Version {props.version}</div>
            </div>
            <button ref={closeButtonRef} className={`${minimalButton} ${headerTextColour}`} onClick={props.onClose}>Close</button>
          </div>

          <div className="mt-3 text-sm text-gray-700 dark:text-gray-300">
            <p>wisty is licensed under the GPL-3 and is copyright 2026.</p>
          </div>

          <div className="mt-4">
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Many thanks to the developers of these libraries included in wisty.</div>
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">Scroll for the full list</div>
            <div className="relative mt-2 rounded border border-gray-200 dark:border-gray-700">
              <div className="max-h-[calc(80vh-240px)] overflow-y-auto pb-2">
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  <For each={openSourceLibraries}>
                    {(library) => (
                      <div className="flex items-center gap-3 px-3 py-2">
                        <span className="min-w-0 flex-1 truncate text-sm text-gray-700 dark:text-gray-200">{library.name}</span>
                        <button className="rounded px-2 py-0.5 text-xs text-blue-700 ring-1 ring-blue-200 hover:bg-blue-50 dark:text-blue-300 dark:ring-blue-800 dark:hover:bg-blue-900/20" onClick={() => openInDefault(library.url)}>Open</button>
                      </div>
                    )}
                  </For>
                </div>
              </div>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 rounded-b bg-gradient-to-t from-white to-transparent dark:from-gray-800 dark:to-transparent" />
            </div>
          </div>

          <div className="mt-4 flex flex-row items-center">
            <button className={colouredButton("blue")} onClick={() => openInDefault("https://github.com/timothy-strange/wisty")}>wisty repository</button>
          </div>
        </div>
      </div>
    </Show>
  );
}
