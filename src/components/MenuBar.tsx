import { For, Show, createEffect } from "solid-js";
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
  onRequestEditorFocus: () => void;
};

const commandLabel = (definition: CommandDefinition) => {
  if (!definition.checked) {
    return definition.label;
  }
  return `${definition.label}${definition.checked() ? " ✓" : ""}`;
};

export const MenuBar = (props: MenuBarProps) => {
  const triggerRefs = new Map<string, HTMLElement>();
  let closeTriggeredByEscape = false;

  createEffect(() => {
    const activeMenuId = props.activeMenuId;
    if (!activeMenuId) {
      return;
    }
    const trigger = triggerRefs.get(activeMenuId);
    trigger?.focus();
  });

  const executeCommand = async (commandId: string) => {
    await props.registry.execute(commandId);
    props.onActiveMenuIdChange(null);
  };

  return (
    <MenubarRoot
      class="menu-bar"
      role="menubar"
      aria-label="Application menu"
      value={props.activeMenuId ?? undefined}
      onValueChange={(value) => props.onActiveMenuIdChange(value ?? null)}
      loop
    >
      <For each={props.sections}>
        {(section) => (
          <MenubarMenu
            value={section.id}
            onOpenChange={(open) => {
              if (!open) {
                props.onActiveMenuIdChange(null);
              }
            }}
          >
            <MenubarTrigger
              class="menu-trigger"
              ref={(element) => {
                triggerRefs.set(section.id, element);
              }}
            >
              {section.label}
            </MenubarTrigger>
            <MenubarPortal>
              <MenubarContent
                class="menu-popover"
                onEscapeKeyDown={() => {
                  closeTriggeredByEscape = true;
                }}
                onCloseAutoFocus={(event) => {
                  props.onActiveMenuIdChange(null);
                  if (closeTriggeredByEscape) {
                    closeTriggeredByEscape = false;
                    event.preventDefault();
                    props.onRequestEditorFocus();
                    return;
                  }
                  closeTriggeredByEscape = false;
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
