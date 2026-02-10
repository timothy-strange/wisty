import { createEffect, createSignal, onCleanup, type Accessor } from "solid-js";
import type { CommandRegistry } from "../commands/commandRegistry";

type UseMenuCommandPipelineOptions = {
  menuPanelOpen: Accessor<boolean>;
  setMenuPanelOpen: (value: boolean) => void;
  setActiveMenuId: (value: string | null) => void;
  commandRegistry: CommandRegistry;
  focusEditor: () => void;
  isInteractionBlocked: Accessor<boolean>;
};

export const useMenuCommandPipeline = (options: UseMenuCommandPipelineOptions) => {
  const [pendingMenuCommandId, setPendingMenuCommandId] = createSignal<string | null>(null);
  let pendingMenuCommandFrame = 0;

  const executePendingMenuCommand = async () => {
    if (options.isInteractionBlocked()) {
      setPendingMenuCommandId(null);
      return;
    }

    const commandId = pendingMenuCommandId();
    if (!commandId) {
      return;
    }

    setPendingMenuCommandId(null);
    const command = options.commandRegistry.get(commandId);
    const executed = await options.commandRegistry.execute(commandId);
    if (!executed) {
      return;
    }

    if (command?.refocusEditorOnMenuSelect) {
      options.focusEditor();
    }
  };

  const schedulePendingMenuCommandExecution = () => {
    if (!pendingMenuCommandId()) {
      return;
    }
    if (pendingMenuCommandFrame !== 0) {
      return;
    }
    pendingMenuCommandFrame = requestAnimationFrame(() => {
      pendingMenuCommandFrame = 0;
      void executePendingMenuCommand();
    });
  };

  const handleMenuCommandSelected = (commandId: string) => {
    if (options.isInteractionBlocked()) {
      return;
    }
    setPendingMenuCommandId(commandId);
    options.setActiveMenuId(null);
    options.setMenuPanelOpen(false);
  };

  const handleMenuPanelOpenChange = (nextOpen: boolean) => {
    const wasOpen = options.menuPanelOpen();
    options.setMenuPanelOpen(nextOpen);
    if (!nextOpen) {
      options.setActiveMenuId(null);
    }
    if (wasOpen && !nextOpen) {
      schedulePendingMenuCommandExecution();
    }
  };

  createEffect(() => {
    const pending = pendingMenuCommandId();
    if (!pending) {
      return;
    }
    if (options.menuPanelOpen()) {
      return;
    }
    schedulePendingMenuCommandExecution();
  });

  onCleanup(() => {
    if (pendingMenuCommandFrame !== 0) {
      cancelAnimationFrame(pendingMenuCommandFrame);
      pendingMenuCommandFrame = 0;
    }
  });

  return {
    handleMenuCommandSelected,
    handleMenuPanelOpenChange
  };
};
