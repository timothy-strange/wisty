export type CommandDefinition = {
  id: string;
  label: string;
  shortcut?: string;
  run: () => void | Promise<void>;
  enabled?: () => boolean;
  checked?: () => boolean;
  refocusEditorOnMenuSelect?: boolean;
};

export type MenuItem = {
  type: "command";
  commandId: string;
} | {
  type: "separator";
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
};

export const createCommandRegistry = (definitions: CommandDefinition[]): CommandRegistry => {
  const commandMap = new Map(definitions.map((definition) => [definition.id, definition]));

  const get = (id: string) => commandMap.get(id);

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
    execute
  };
};
