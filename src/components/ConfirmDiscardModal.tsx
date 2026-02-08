import { Show } from "solid-js";

type ConfirmDiscardModalProps = {
  open: boolean;
  onCancel: () => void;
  onDiscard: () => void;
};

export const ConfirmDiscardModal = (props: ConfirmDiscardModalProps) => (
  <Show when={props.open}>
    <div class="modal-backdrop" onClick={props.onCancel}>
      <div class="modal-panel" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <h2>Unsaved changes</h2>
        <p>You have unsaved edits. Discard them and continue?</p>
        <div class="modal-actions">
          <button class="button subtle" onClick={props.onCancel}>Cancel</button>
          <button class="button danger" onClick={props.onDiscard}>Discard</button>
        </div>
      </div>
    </div>
  </Show>
);
