import { For } from "solid-js";
import {
  Root as DialogRoot,
  Portal as DialogPortal,
  Overlay as DialogOverlay,
  Content as DialogContent,
  Title as DialogTitle,
  Description as DialogDescription,
  CloseButton as DialogCloseButton
} from "@kobalte/core/dialog";
import { message } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { libraryCredits } from "../core/about/libraryCredits";

type AboutDialogProps = {
  open: boolean;
  version: string;
  onClose: () => void;
};

const openInBrowser = async (url: string) => {
  try {
    await openUrl(url);
  } catch (error) {
    await message(`Unable to open link: ${String(error)}`);
  }
};

export const AboutDialog = (props: AboutDialogProps) => {
  return (
    <DialogRoot open={props.open} onOpenChange={(open) => { if (!open) props.onClose(); }}>
      <DialogPortal>
        <DialogOverlay class="about-backdrop" />
        <DialogContent class="about-panel" aria-label="About wisty">
          <div class="about-header">
            <div>
              <DialogTitle class="about-title">wisty</DialogTitle>
              <div class="about-version">Version {props.version}</div>
            </div>
            <DialogCloseButton class="button subtle">Close</DialogCloseButton>
          </div>

          <DialogDescription class="about-license">wisty is licensed under the GPL-3 and is copyright 2026.</DialogDescription>

          <div class="about-section">
            <div class="about-section-title">Many thanks to the developers of these libraries included in wisty.</div>
            <div class="about-section-note">Scroll for the full list</div>
            <div class="about-list-shell">
              <div class="about-list">
                <For each={libraryCredits}>
                  {(library) => (
                    <div class="about-list-row">
                      <span class="about-list-name">{library.name}</span>
                      <button class="about-open-link" onClick={() => void openInBrowser(library.url)}>Open</button>
                    </div>
                  )}
                </For>
              </div>
              <div class="about-list-fade" />
            </div>
          </div>

          <div class="about-footer">
            <button class="button" onClick={() => void openInBrowser("https://github.com/timothy-strange/wisty")}>wisty repository</button>
          </div>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
  );
};
