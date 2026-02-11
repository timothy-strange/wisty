import type { CommandDefinition } from "./commandRegistry";

type ShortcutBinding = {
  commandId: string;
  key: string;
  requiresShift: boolean;
  requiresMod: boolean;
  requiresAlt: boolean;
};

type ShortcutRouterDeps = {
  definitions: CommandDefinition[];
  execute: (commandId: string) => Promise<boolean>;
};

const parseShortcut = (commandId: string, shortcut: string): ShortcutBinding | null => {
  const parts = shortcut
    .split("+")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (parts.length === 0) {
    return null;
  }

  const key = parts[parts.length - 1]?.toLowerCase();
  if (!key) {
    return null;
  }

  const modifiers = new Set(parts.slice(0, -1).map((part) => part.toLowerCase()));
  const requiresShift = modifiers.has("shift");
  const requiresMod = modifiers.has("cmd") || modifiers.has("ctrl") || modifiers.has("mod");
  const requiresAlt = modifiers.has("alt");

  return {
    commandId,
    key,
    requiresShift,
    requiresMod,
    requiresAlt
  };
};

const normalizeEventKey = (event: KeyboardEvent): string => {
  if (event.key.length === 1) {
    return event.key.toLowerCase();
  }
  return event.key.toLowerCase();
};

const matchesShortcut = (event: KeyboardEvent, binding: ShortcutBinding): boolean => {
  if (binding.requiresAlt !== event.altKey) {
    return false;
  }

  const hasMod = event.ctrlKey || event.metaKey;
  if (binding.requiresMod !== hasMod) {
    return false;
  }

  if (binding.requiresShift !== event.shiftKey) {
    return false;
  }

  return normalizeEventKey(event) === binding.key;
};

export const createShortcutRouter = (deps: ShortcutRouterDeps) => {
  const bindings: ShortcutBinding[] = [];
  const seenShortcuts = new Set<string>();

  for (const definition of deps.definitions) {
    if (!definition.shortcut) {
      continue;
    }

    const parsed = parseShortcut(definition.id, definition.shortcut);
    if (!parsed) {
      continue;
    }

    const dedupeKey = `${parsed.requiresMod ? "mod" : "plain"}:${parsed.requiresShift ? "shift" : "plain"}:${parsed.requiresAlt ? "alt" : "plain"}:${parsed.key}`;
    if (seenShortcuts.has(dedupeKey)) {
      continue;
    }

    seenShortcuts.add(dedupeKey);
    bindings.push(parsed);
  }

  const dispatch = (event: KeyboardEvent): boolean => {
    for (const binding of bindings) {
      if (!matchesShortcut(event, binding)) {
        continue;
      }
      event.preventDefault();
      void deps.execute(binding.commandId);
      return true;
    }
    return false;
  };

  return {
    dispatch
  };
};
