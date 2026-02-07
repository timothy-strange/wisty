export const modifierLabel = (platformName) => (platformName === "macos" ? "⌘" : "Ctrl");

export const shortcut = (platformName, key, withShift = false) => {
  if (platformName === "macos") {
    return `${modifierLabel(platformName)}${withShift ? "⇧" : ""}${key}`;
  }
  return `${modifierLabel(platformName)}${withShift ? "+Shift" : ""}+${key}`;
};
