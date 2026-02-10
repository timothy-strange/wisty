import {
  Root as DialogRoot,
  Portal as DialogPortal,
  Overlay as DialogOverlay,
  Content as DialogContent,
  Title as DialogTitle,
  Description as DialogDescription
} from "@kobalte/core/dialog";

type FileLoadingModalProps = {
  open: boolean;
  filePath: string;
  bytesRead: number;
  totalBytes?: number;
  largeLineSafeMode?: boolean;
  onCancel: () => void;
};

const formatSizeMb = (sizeBytes: number): string => (sizeBytes / (1024 * 1024)).toFixed(1);

const clampPercent = (value: number): number => {
  if (value < 0) {
    return 0;
  }
  if (value > 100) {
    return 100;
  }
  return value;
};

export const FileLoadingModal = (props: FileLoadingModalProps) => {
  const hasDeterminateProgress = () =>
    typeof props.totalBytes === "number" && props.totalBytes > 0;

  const progressPercent = () => {
    if (!hasDeterminateProgress()) {
      return 0;
    }
    return clampPercent((props.bytesRead / (props.totalBytes as number)) * 100);
  };

  return (
    <DialogRoot
      open={props.open}
      onOpenChange={(open) => {
        if (!open) {
          return;
        }
      }}
    >
      <DialogPortal>
        <DialogOverlay class="modal-backdrop file-loading-backdrop" />
        <DialogContent class="modal-panel file-loading-panel" aria-label="Opening file">
          <DialogTitle>Opening file...</DialogTitle>
          <DialogDescription>
            {hasDeterminateProgress()
              ? `Loaded ${formatSizeMb(props.bytesRead)} MB of ${formatSizeMb(props.totalBytes as number)} MB`
              : "Loading file contents"}
          </DialogDescription>
          {props.largeLineSafeMode ? <p class="file-loading-note">Large-line safe mode enabled</p> : null}
          <p class="file-loading-path" title={props.filePath}>{props.filePath}</p>

          <div class="file-loading-progress-shell" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={hasDeterminateProgress() ? Math.round(progressPercent()) : undefined}>
            <div
              class={`file-loading-progress-fill ${hasDeterminateProgress() ? "" : "indeterminate"}`.trim()}
              style={hasDeterminateProgress() ? { width: `${progressPercent()}%` } : undefined}
            />
          </div>

          <div class="modal-actions">
            <button class="button subtle" onClick={props.onCancel}>Cancel</button>
          </div>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
  );
};
