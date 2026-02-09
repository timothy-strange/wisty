import { createSignal, type Accessor } from "solid-js";
import type { AsyncAction, CloseFlowState, CloseRequestEvent, ErrorReporter } from "./contracts";

type UseCloseFlowDeps = {
  isDirty: Accessor<boolean>;
  closeWindow: () => Promise<void>;
  focusEditor: () => void;
  errors: ErrorReporter;
};

const ACTION_ERROR_CONTEXT = "Unable to complete action";

export const useCloseFlow = (deps: UseCloseFlowDeps) => {
  const [confirmDiscardOpen, setConfirmDiscardOpen] = createSignal(false);
  const [pendingAction, setPendingAction] = createSignal<AsyncAction | null>(null);
  const [closeFlowState, setCloseFlowState] = createSignal<CloseFlowState>("idle");

  const closeApplicationAction = async () => {
    setCloseFlowState("force-closing");
    await deps.closeWindow();
  };

  const clearCloseIntent = () => {
    if (closeFlowState() === "awaiting-discard") {
      setCloseFlowState("idle");
    }
  };

  const runOrConfirmDiscard = async (action: AsyncAction) => {
    if (!deps.isDirty()) {
      await action();
      return;
    }
    setPendingAction(() => action);
    setConfirmDiscardOpen(true);
  };

  const requestClose = async () => {
    if (!deps.isDirty()) {
      await closeApplicationAction();
      return;
    }
    setPendingAction(() => closeApplicationAction);
    setCloseFlowState("awaiting-discard");
    setConfirmDiscardOpen(true);
  };

  const resolveConfirmDiscard = async (shouldDiscard: boolean) => {
    setConfirmDiscardOpen(false);
    const action = pendingAction();
    setPendingAction(null);

    if (!action) {
      clearCloseIntent();
      deps.focusEditor();
      return;
    }

    if (!shouldDiscard) {
      clearCloseIntent();
      deps.focusEditor();
      return;
    }

    try {
      await action();
    } catch (error) {
      await deps.errors.showError(ACTION_ERROR_CONTEXT, error);
      deps.focusEditor();
    }
  };

  const handleWindowCloseRequested = (event: CloseRequestEvent) => {
    if (closeFlowState() === "force-closing") {
      setCloseFlowState("idle");
      return;
    }
    if (!deps.isDirty()) {
      return;
    }
    event.preventDefault();
    setPendingAction(() => closeApplicationAction);
    setCloseFlowState("awaiting-discard");
    setConfirmDiscardOpen(true);
  };

  return {
    closeFlowState,
    confirmDiscardOpen,
    runOrConfirmDiscard,
    requestClose,
    resolveConfirmDiscard,
    handleWindowCloseRequested
  };
};
