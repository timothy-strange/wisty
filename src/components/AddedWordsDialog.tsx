import { For, Show } from "solid-js";
import {
  Root as DialogRoot,
  Portal as DialogPortal,
  Overlay as DialogOverlay,
  Content as DialogContent,
  Title as DialogTitle,
  CloseButton as DialogCloseButton
} from "@kobalte/core/dialog";

type AddedWordsDialogProps = {
  open: boolean;
  words: string[];
  onClose: () => void;
  onRemove: (word: string) => void;
};

export const AddedWordsDialog = (props: AddedWordsDialogProps) => {
  return (
    <DialogRoot open={props.open} onOpenChange={(open) => { if (!open) props.onClose(); }}>
      <DialogPortal>
        <DialogOverlay class="modal-backdrop added-words-dialog-backdrop" />
        <DialogContent class="modal-panel added-words-dialog-panel" aria-label="Added Words">
          <div class="about-header">
            <DialogTitle class="about-title">Added Words</DialogTitle>
            <DialogCloseButton class="button subtle">Close</DialogCloseButton>
          </div>

          <Show
            when={props.words.length > 0}
            fallback={<div class="list-empty">No words have been added yet.</div>}
          >
            <div class="list-shell">
              <div class="list">
                <For each={props.words}>
                  {(word) => (
                    <div class="list-row">
                      <span class="list-name">{word}</span>
                      <button class="list-action-link" onClick={() => props.onRemove(word)}>Remove</button>
                    </div>
                  )}
                </For>
              </div>
              <div class="list-fade" />
            </div>
          </Show>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
  );
};
