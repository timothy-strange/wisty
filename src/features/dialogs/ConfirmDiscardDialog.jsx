import { Show, createEffect, onCleanup, onMount } from "solid-js";
import { colouredButton, minimalButton } from "../../constants/ui";
import { ddebug, dtrace } from "../../lib/debugLog";

export default function ConfirmDiscardDialog(props) {
  dtrace("close-dialog", "component function entered", { closeReqId: props.closeReqId, open: props.open });

  onMount(() => {
    ddebug("close-dialog", "onMount", { closeReqId: props.closeReqId, open: props.open });
  });

  onCleanup(() => {
    ddebug("close-dialog", "onCleanup", { closeReqId: props.closeReqId });
  });

  createEffect(() => {
    ddebug("close-dialog", "open prop changed", { closeReqId: props.closeReqId, open: props.open });
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
            <div className="w-[360px] rounded border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-800" onClick={(event) => event.stopPropagation()}>
              <div className="flex flex-row items-start">
                <div className="flex-1">
                  <div className="text-base font-semibold text-gray-900 dark:text-gray-100">Warning</div>
                  <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">You have unsaved changes</div>
                </div>
              </div>
              <div className="mt-4 flex flex-row items-center justify-end gap-2">
                <button className={minimalButton} onClick={() => { ddebug("close-dialog", "cancel clicked", { closeReqId: props.closeReqId }); props.onCancel(); }}>Cancel</button>
                <button className={colouredButton("red")} onClick={() => { ddebug("close-dialog", "discard clicked", { closeReqId: props.closeReqId }); props.onDiscard(); }}>Discard</button>
              </div>
            </div>
          </div>
        );
      })()}
    </Show>
  );
}
