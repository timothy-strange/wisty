import { onCleanup, onMount } from "solid-js";
import type { CloseRequestEvent, DocumentPort, EditorPort } from "./contracts";

type UseAppLifecycleOptions = {
  getEditorHost: () => HTMLDivElement | undefined;
  editor: Pick<EditorPort, "setHost" | "init" | "setText" | "getRevision" | "focus" | "destroy" | "applySettings">;
  document: Pick<DocumentPort, "markCleanAt">;
  loadSettings: () => Promise<void>;
  onSettingsLoadError: (error: unknown) => Promise<void>;
  loadVersion: () => Promise<string>;
  setAppVersion: (version: string) => void;
  handleGlobalKeydown: (event: KeyboardEvent) => void;
  registerCloseRequested: (
    handler: (event: CloseRequestEvent) => void
  ) => Promise<() => void>;
  handleWindowCloseRequested: (event: CloseRequestEvent) => void;
};

export const useAppLifecycle = (options: UseAppLifecycleOptions) => {
  let unlistenCloseRequest: (() => void) | undefined;

  onMount(() => {
    const editorHost = options.getEditorHost();
    if (!editorHost) {
      return;
    }

    options.editor.setHost(editorHost);
    options.editor.init();
    options.editor.setText("", { emitChange: false });
    options.document.markCleanAt(options.editor.getRevision());
    options.editor.focus();

    window.addEventListener("keydown", options.handleGlobalKeydown);

    void options
      .loadSettings()
      .then(() => {
        options.editor.applySettings();
      })
      .catch(async (error) => {
        await options.onSettingsLoadError(error);
      });

    void options
      .loadVersion()
      .then((version) => {
        options.setAppVersion(version);
      })
      .catch(() => {
        // keep fallback version
      });

    void options
      .registerCloseRequested((event) => {
        options.handleWindowCloseRequested(event);
      })
      .then((unlisten) => {
        unlistenCloseRequest = unlisten;
      });
  });

  onCleanup(() => {
    window.removeEventListener("keydown", options.handleGlobalKeydown);
    if (unlistenCloseRequest) {
      unlistenCloseRequest();
      unlistenCloseRequest = undefined;
    }
    options.editor.destroy();
  });
};
