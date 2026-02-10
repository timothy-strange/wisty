import {
  Root as DialogRoot,
  Portal as DialogPortal,
  Overlay as DialogOverlay,
  Content as DialogContent,
  Title as DialogTitle,
  Description as DialogDescription,
  CloseButton as DialogCloseButton
} from "@kobalte/core/dialog";

type ConfirmDiscardModalProps = {
  open: boolean;
  onCancel: () => void;
  onDiscard: () => void;
};

export const ConfirmDiscardModal = (props: ConfirmDiscardModalProps) => (
  <DialogRoot open={props.open} onOpenChange={(open) => { if (!open) props.onCancel(); }}>
    <DialogPortal>
      <DialogOverlay class="modal-backdrop discard-dialog-backdrop" />
      <DialogContent class="modal-panel discard-dialog-panel" aria-label="Discard changes confirmation">
        <DialogTitle>Warning</DialogTitle>
        <DialogDescription>You have unsaved changes</DialogDescription>
        <div class="modal-actions">
          <DialogCloseButton class="button subtle">Cancel</DialogCloseButton>
          <button class="button danger" onClick={props.onDiscard}>Discard</button>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
);
