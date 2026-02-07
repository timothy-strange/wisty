import { Show } from "solid-js";
import { open as openInDefault } from "@tauri-apps/plugin-shell";
import { colouredButton, headerTextColour, minimalButton } from "../../constants/ui";

export default function AboutDialog(props) {
  return (
    <Show when={props.open}>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={props.onClose}>
        <div className="w-[360px] rounded border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-800" onClick={(event) => event.stopPropagation()}>
          <div className="flex flex-row items-start">
            <div className="mr-auto">
              <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">Wisty</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Version {props.version}</div>
            </div>
            <button className={`${minimalButton} ${headerTextColour}`} onClick={props.onClose}>Close</button>
          </div>

          <div className="mt-3 space-y-1 text-sm text-gray-700 dark:text-gray-300">
            <div>License: GPL-3.0</div>
            <div>Platform: {props.platformName}</div>
            <div>Copyright 2026</div>
          </div>

          <div className="mt-4 flex flex-row items-center">
            <button className={colouredButton("blue")} onClick={() => openInDefault("https://github.com/timothy-strange/wisty")}>GitHub Repo</button>
          </div>
        </div>
      </div>
    </Show>
  );
}
