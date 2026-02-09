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
import { CommandDefinition, MenuSection, createCommandRegistry } from "../core/commands/commandRegistry";

type MenuBarProps = {
  sections: MenuSection[];
  registry: ReturnType<typeof createCommandRegistry>;
  activeMenuId: string | null;
  onActiveMenuIdChange: (value: string | null) => void;
  menuPanelOpen: boolean;
  onMenuPanelOpenChange: (value: boolean) => void;
  onRequestEditorFocus: () => void;
};

const commandLabel = (definition: CommandDefinition) => {
  if (!definition.checked) {
    return definition.label;
  }
  return `${definition.label}${definition.checked() ? " ✓" : ""}`;
};

export const MenuBar = (props: MenuBarProps) => {
  let closedByEscape = false;
  let closedBySelection = false;

  const executeCommand = async (commandId: string) => {
    closedBySelection = true;
    await props.registry.execute(commandId);
    props.onActiveMenuIdChange(null);
    props.onMenuPanelOpenChange(false);
  };

  return (
    <MenubarRoot
      class="menu-bar"
      role="menubar"
      aria-label="Application menu"
      value={props.activeMenuId ?? undefined}
      onValueChange={(value) => {
        props.onActiveMenuIdChange(value ?? null);
        if (value == null) {
          props.onMenuPanelOpenChange(false);
        }
      }}
      autoFocusMenu={props.menuPanelOpen}
      onAutoFocusMenuChange={(isOpen) => {
        const nextOpen = Boolean(isOpen);
        props.onMenuPanelOpenChange(nextOpen);
        if (!nextOpen) {
          props.onActiveMenuIdChange(null);
        }
      }}
      loop
    >
      <For each={props.sections}>
        {(section) => (
          <MenubarMenu value={section.id}>
            <MenubarTrigger class="menu-trigger">
              {section.label}
            </MenubarTrigger>
            <MenubarPortal>
              <MenubarContent
                class="menu-popover"
                onEscapeKeyDown={() => {
                  closedByEscape = true;
                }}
                onCloseAutoFocus={(event) => {
                  if (closedByEscape || closedBySelection) {
                    closedByEscape = false;
                    closedBySelection = false;
                    event.preventDefault();
                    props.onActiveMenuIdChange(null);
                    props.onMenuPanelOpenChange(false);
                    props.onRequestEditorFocus();
                  }
                }}
              >
                <For each={section.items}>
                  {(item) => {
                    if (item.type === "separator") {
                      return <MenubarSeparator class="menu-separator" />;
                    }
                    const command = props.registry.get(item.commandId);
                    if (!command) {
                      return null;
                    }
                    const enabled = command.enabled ? command.enabled() : true;

                    return (
                      <MenubarItem
                        class="menu-item"
                        disabled={!enabled}
                        onSelect={() => void executeCommand(command.id)}
                        closeOnSelect
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
