export type CommandDefinition = {
  id: string;
  label: string;
  shortcut?: string;
  run: () => void | Promise<void>;
  enabled?: () => boolean;
  checked?: () => boolean;
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

export const createCommandRegistry = (definitions: CommandDefinition[]) => {
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
