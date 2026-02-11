import type { Accessor } from "solid-js";

type UseGlobalKeyRoutingOptions = {
  fileLoading: Accessor<boolean>;
  requestCancelFileLoad: () => void;
  fileSaving: Accessor<boolean>;
  requestCancelFileSave: () => void;
  errorModalOpen: Accessor<boolean>;
  dismissErrorModal: () => void;
  aboutOpen: Accessor<boolean>;
  confirmDiscardOpen: Accessor<boolean>;
  resolveConfirmDiscard: (shouldDiscard: boolean) => Promise<void>;
  menuPanelOpen: Accessor<boolean>;
  openMenuByMnemonic: (key: string) => boolean;
  dispatchShortcut: (event: KeyboardEvent) => boolean;
};

export const useGlobalKeyRouting = (options: UseGlobalKeyRoutingOptions) => {
  const handleGlobalKeydown = (event: KeyboardEvent) => {
    if (options.errorModalOpen()) {
      if (event.key === "Escape") {
        event.preventDefault();
        options.dismissErrorModal();
      }
      return;
    }

    if (options.fileLoading()) {
      if (event.key === "Escape") {
        event.preventDefault();
        options.requestCancelFileLoad();
        return;
      }
      event.preventDefault();
      return;
    }

    if (options.fileSaving()) {
      if (event.key === "Escape") {
        event.preventDefault();
        options.requestCancelFileSave();
        return;
      }
      event.preventDefault();
      return;
    }

    if (options.aboutOpen()) {
      return;
    }

    if (options.confirmDiscardOpen()) {
      if (event.key === "Escape") {
        event.preventDefault();
        void options.resolveConfirmDiscard(false);
      }
      return;
    }

    if (event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
      if (options.openMenuByMnemonic(event.key)) {
        event.preventDefault();
        return;
      }
    }

    if (options.menuPanelOpen()) {
      return;
    }

    options.dispatchShortcut(event);
  };

  return {
    handleGlobalKeydown
  };
};
