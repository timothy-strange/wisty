import { For, Show, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import { CommandDefinition, MenuSection, createCommandRegistry } from "../core/commands/commandRegistry";

type MenuBarProps = {
  sections: MenuSection[];
  registry: ReturnType<typeof createCommandRegistry>;
};

const commandLabel = (definition: CommandDefinition) => {
  if (!definition.checked) {
    return definition.label;
  }
  return `${definition.label}${definition.checked() ? " ✓" : ""}`;
};

export const MenuBar = (props: MenuBarProps) => {
  const [openSectionId, setOpenSectionId] = createSignal<string | null>(null);
  let menuRootRef: HTMLDivElement | undefined;

  const openSection = (sectionId: string) => setOpenSectionId(sectionId);

  const closeSection = () => setOpenSectionId(null);

  const activeSectionIndex = createMemo(() => {
    const currentId = openSectionId();
    if (!currentId) {
      return -1;
    }
    return props.sections.findIndex((section) => section.id === currentId);
  });

  const handleKeydown = (event: KeyboardEvent) => {
    const openId = openSectionId();
    if (!openId) {
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      closeSection();
      return;
    }

    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      const currentIndex = activeSectionIndex();
      if (currentIndex === -1) {
        return;
      }
      const delta = event.key === "ArrowLeft" ? -1 : 1;
      const next = (currentIndex + delta + props.sections.length) % props.sections.length;
      event.preventDefault();
      openSection(props.sections[next].id);
    }
  };

  onMount(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRootRef) {
        return;
      }
      if (!menuRootRef.contains(event.target as Node)) {
        closeSection();
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeydown);

    onCleanup(() => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeydown);
    });
  });

  const executeCommand = async (commandId: string) => {
    await props.registry.execute(commandId);
    closeSection();
  };

  return (
    <div ref={menuRootRef} class="menu-bar" role="menubar">
      <For each={props.sections}>
        {(section) => (
          <div class="menu-section" onMouseEnter={() => openSectionId() && openSection(section.id)}>
            <button
              class={`menu-trigger${openSectionId() === section.id ? " open" : ""}`}
              onClick={() => (openSectionId() === section.id ? closeSection() : openSection(section.id))}
              aria-haspopup="true"
              aria-expanded={openSectionId() === section.id}
            >
              {section.label}
            </button>

            <Show when={openSectionId() === section.id}>
              <div class="menu-popover" role="menu">
                <For each={section.items}>
                  {(item) => {
                    if (item.type === "separator") {
                      return <div class="menu-separator" />;
                    }
                    const command = props.registry.get(item.commandId);
                    if (!command) {
                      return null;
                    }
                    const enabled = command.enabled ? command.enabled() : true;
                    return (
                      <button
                        class="menu-item"
                        role="menuitem"
                        disabled={!enabled}
                        onClick={() => void executeCommand(command.id)}
                      >
                        <span class="menu-item-label">{commandLabel(command)}</span>
                        <Show when={command.shortcut}>
                          <span class="menu-item-shortcut">{command.shortcut}</span>
                        </Show>
                      </button>
                    );
                  }}
                </For>
              </div>
            </Show>
          </div>
        )}
      </For>
    </div>
  );
};
