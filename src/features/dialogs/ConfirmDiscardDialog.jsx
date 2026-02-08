import { Show, createEffect, onCleanup, onMount } from "solid-js";
import { colouredButton, minimalButton } from "../../constants/ui";
import { ddebug, dtrace } from "../../lib/debugLog";

export default function ConfirmDiscardDialog(props) {
  let cancelButtonRef;
  let discardButtonRef;

  dtrace("close-dialog", "component function entered", { closeReqId: props.closeReqId, open: props.open });

  onMount(() => {
    ddebug("close-dialog", "onMount", { closeReqId: props.closeReqId, open: props.open });
  });

  onCleanup(() => {
    ddebug("close-dialog", "onCleanup", { closeReqId: props.closeReqId });
  });

  createEffect(() => {
    ddebug("close-dialog", "open prop changed", { closeReqId: props.closeReqId, open: props.open });
    if (props.open) {
      queueMicrotask(() => {
        if (cancelButtonRef) {
          cancelButtonRef.focus();
          ddebug("close-dialog", "initial focus set", { closeReqId: props.closeReqId, target: "cancel" });
        }
      });
    }
  });

  dtrace("close-dialog", "render", { closeReqId: props.closeReqId, open: props.open });

  return (
    <Show
      when={props.open}
      fallback={(() => {
        dtrace("close-dialog", "render returns null", { closeReqId: props.closeReqId });
        return null;
      })()}
    >
      {(() => {
        dtrace("close-dialog", "render visible dialog", { closeReqId: props.closeReqId });
        return (
          <div data-test="confirm-discard-dialog" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div
              role="dialog"
              aria-modal="true"
              className="w-[360px] rounded border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-800"
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  event.stopPropagation();
                  ddebug("close-dialog", "escape key cancels dialog", { closeReqId: props.closeReqId });
                  props.onCancel();
                  return;
                }
                if (event.key !== "Tab") {
                  return;
                }
                const focusables = [cancelButtonRef, discardButtonRef].filter(Boolean);
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
                ddebug("close-dialog", "tab focus trapped", {
                  closeReqId: props.closeReqId,
                  shiftKey: event.shiftKey,
                  nextIndex
                });
              }}
            >
              <div className="flex flex-row items-start">
                <div className="flex-1">
                  <div className="text-base font-semibold text-gray-900 dark:text-gray-100">Warning</div>
                  <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">You have unsaved changes</div>
                </div>
              </div>
              <div className="mt-4 flex flex-row items-center justify-end gap-2">
                <button ref={cancelButtonRef} className={minimalButton} onClick={() => { ddebug("close-dialog", "cancel clicked", { closeReqId: props.closeReqId }); props.onCancel(); }}>Cancel</button>
                <button ref={discardButtonRef} className={colouredButton("red")} onClick={() => { ddebug("close-dialog", "discard clicked", { closeReqId: props.closeReqId }); props.onDiscard(); }}>Discard</button>
              </div>
            </div>
          </div>
        );
      })()}
    </Show>
  );
}
