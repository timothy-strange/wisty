export type CommandDefinition = {
  id: string;
  label: string;
  getLabel?: () => string;
  shortcut?: string;
  run: () => void | Promise<void>;
  enabled?: () => boolean;
  checked?: () => boolean;
  refocusEditorOnMenuSelect?: boolean;
};

export type MenuItem = {
  type: "command";
  commandId: string;
  visible?: () => boolean;
} | {
  type: "separator";
  visible?: () => boolean;
} | {
  type: "submenu";
  id: string;
  label: string;
  getLabel?: () => string;
  visible?: () => boolean;
  items: () => MenuItem[];
};

export type MenuSection = {
  id: string;
  label: string;
  items: MenuItem[];
};

export type CommandRegistry = {
  definitions: CommandDefinition[];
  get: (id: string) => CommandDefinition | undefined;
  execute: (id: string) => Promise<boolean>;
  register: (definition: CommandDefinition) => void;
};

export const createCommandRegistry = (definitions: CommandDefinition[]): CommandRegistry => {
  const commandMap = new Map(definitions.map((definition) => [definition.id, definition]));

  const get = (id: string) => commandMap.get(id);

  /** Registers (or replaces) a command at runtime, e.g. dynamically-discovered items. */
  const register = (definition: CommandDefinition) => {
    commandMap.set(definition.id, definition);
  };

  const execute = async (id: string) => {
    const command = get(id);
    if (!command) {
      return false;
    }
    if (command.enabled && !command.enabled()) {
      return false;
    }
    await command.run();
    return true;
  };

  return {
    definitions,
    get,
    execute,
    register
  };
};
