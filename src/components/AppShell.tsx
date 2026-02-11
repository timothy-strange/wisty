import { Show } from "solid-js";
import { AboutDialog } from "./AboutDialog";
import { ConfirmDiscardModal } from "./ConfirmDiscardModal";
import { ErrorModal } from "./ErrorModal";
import { FileLoadingModal } from "./FileLoadingModal";
import { FileSavingModal } from "./FileSavingModal";
import { LargeFileOpenModal } from "./LargeFileOpenModal";
import { MenuBar } from "./MenuBar";
import type { ErrorModalEntry } from "../core/app/useErrorModalQueue";

type AppShellProps = {
  setEditorHostRef: (node: HTMLDivElement) => void;
  safeModeActive: boolean;
  aboutOpen: boolean;
  appVersion: string;
  confirmDiscardOpen: boolean;
  onConfirmDiscardCancel: () => void;
  onConfirmDiscard: () => void;
  onAboutClose: () => void;
  onAboutError: (payload: {
    title: string;
    message: string;
    code?: string;
    details?: Record<string, unknown>;
  }) => void;
  largeFileDialog: {
    open: boolean;
    kind: "confirm" | "blocked";
    filePath: string;
    sizeBytes: number;
    onCancel: () => void;
    onOpenAnyway: () => void;
    onAcknowledge: () => void;
  };
  showTransferHitBlocker: boolean;
  loading: {
    overlayOpen: boolean;
    filePath: string;
    bytesRead: number;
    totalBytes?: number;
    largeLineSafeMode: boolean;
    onCancel: () => void;
  };
  saving: {
    overlayOpen: boolean;
    filePath: string;
    charsWritten: number;
    totalChars?: number;
    onCancel: () => void;
  };
  errorModal: {
    open: boolean;
    entry: ErrorModalEntry | null;
    onDismiss: () => void;
  };
};

export const AppShell = (props: AppShellProps) => {
  return (
    <main class="app-shell">
      <MenuBar />

      <section class="editor-shell">
        <div ref={props.setEditorHostRef} class="editor-host" />
      </section>

      <Show when={props.safeModeActive}>
        <div class="large-line-safe-banner">Opened in large-line safe mode for stability.</div>
      </Show>

      <ConfirmDiscardModal
        open={props.confirmDiscardOpen}
        onCancel={props.onConfirmDiscardCancel}
        onDiscard={props.onConfirmDiscard}
      />

      <AboutDialog
        open={props.aboutOpen}
        version={props.appVersion}
        onClose={props.onAboutClose}
        onError={props.onAboutError}
      />

      <LargeFileOpenModal
        open={props.largeFileDialog.open}
        kind={props.largeFileDialog.kind}
        filePath={props.largeFileDialog.filePath}
        sizeBytes={props.largeFileDialog.sizeBytes}
        onCancel={props.largeFileDialog.onCancel}
        onOpenAnyway={props.largeFileDialog.onOpenAnyway}
        onAcknowledge={props.largeFileDialog.onAcknowledge}
      />

      <Show when={props.showTransferHitBlocker}>
        <div class="file-loading-hit-blocker" aria-hidden="true" />
      </Show>

      <FileLoadingModal
        open={props.loading.overlayOpen}
        filePath={props.loading.filePath}
        bytesRead={props.loading.bytesRead}
        totalBytes={props.loading.totalBytes}
        largeLineSafeMode={props.loading.largeLineSafeMode}
        onCancel={props.loading.onCancel}
      />

      <FileSavingModal
        open={props.saving.overlayOpen}
        filePath={props.saving.filePath}
        charsWritten={props.saving.charsWritten}
        totalChars={props.saving.totalChars}
        onCancel={props.saving.onCancel}
      />

      <ErrorModal
        open={props.errorModal.open}
        entry={props.errorModal.entry}
        onDismiss={props.errorModal.onDismiss}
      />
    </main>
  );
};
