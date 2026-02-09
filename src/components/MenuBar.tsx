import { For, Show } from "solid-js";
import {
  Root as MenubarRoot,
  Menu as MenubarMenu,
  Trigger as MenubarTrigger,
  Portal as MenubarPortal,
  Content as MenubarContent,
  Item as MenubarItem,
  Separator as MenubarSeparator
} from "@kobalte/core/menubar";
import { useCommandsContext, useMenuContext } from "../core/app/appContexts";
import { CommandDefinition } from "../core/commands/commandRegistry";

const commandLabel = (definition: CommandDefinition) => {
  if (!definition.checked) {
    return definition.label;
  }
  return `${definition.label}${definition.checked() ? " ✓" : ""}`;
};

export const MenuBar = () => {
  const commands = useCommandsContext();
  const menu = useMenuContext();
  let closeReason: "none" | "escape" = "none";

  return (
    <MenubarRoot
      class="menu-bar"
      role="menubar"
      aria-label="Application menu"
      value={menu.activeMenuId() ?? undefined}
      onValueChange={(value) => {
        menu.onActiveMenuIdChange(value ?? null);
        if (value == null) {
          menu.onMenuPanelOpenChange(false);
        }
      }}
      autoFocusMenu={menu.menuPanelOpen()}
      onAutoFocusMenuChange={(isOpen) => {
        const nextOpen = Boolean(isOpen);
        menu.onMenuPanelOpenChange(nextOpen);
        if (!nextOpen) {
          menu.onActiveMenuIdChange(null);
        }
      }}
      loop
    >
      <For each={commands.sections}>
        {(section) => (
          <MenubarMenu value={section.id}>
            <MenubarTrigger class="menu-trigger">
              {section.label}
            </MenubarTrigger>
            <MenubarPortal>
              <MenubarContent
                class="menu-popover"
                onEscapeKeyDown={() => {
                  closeReason = "escape";
                }}
                onCloseAutoFocus={(event) => {
                  if (closeReason === "escape") {
                    closeReason = "none";
                    event.preventDefault();
                    menu.onActiveMenuIdChange(null);
                    menu.onMenuPanelOpenChange(false);
                    menu.onRequestEditorFocus();
                    return;
                  }
                  closeReason = "none";
                }}
              >
                <For each={section.items}>
                  {(item) => {
                    if (item.type === "separator") {
                      return <MenubarSeparator class="menu-separator" />;
                    }
                    const command = commands.registry.get(item.commandId);
                    if (!command) {
                      return null;
                    }
                    const enabled = command.enabled ? command.enabled() : true;

                    return (
                      <MenubarItem
                        class="menu-item"
                        disabled={!enabled}
                        onSelect={() => {
                          menu.onMenuCommandSelected(command.id);
                        }}
                      >
                        <span class="menu-item-label">{commandLabel(command)}</span>
                        <Show when={command.shortcut}>
                          <span class="menu-item-shortcut">{command.shortcut}</span>
                        </Show>
                      </MenubarItem>
                    );
                  }}
                </For>
              </MenubarContent>
            </MenubarPortal>
          </MenubarMenu>
        )}
      </For>
    </MenubarRoot>
  );
};
