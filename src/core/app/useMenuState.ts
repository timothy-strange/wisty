import { createSignal } from "solid-js";

const MENU_ID_BY_MNEMONIC: Record<string, string> = {
  f: "file",
  e: "edit",
  v: "view",
  h: "help"
};

export const useMenuState = () => {
  const [activeMenuId, setActiveMenuId] = createSignal<string | null>(null);
  const [menuPanelOpen, setMenuPanelOpen] = createSignal(false);

  const openByMnemonic = (key: string) => {
    const menuId = MENU_ID_BY_MNEMONIC[key.toLowerCase()];
    if (!menuId) {
      return false;
    }
    setActiveMenuId(menuId);
    setMenuPanelOpen(true);
    return true;
  };

  return {
    activeMenuId,
    setActiveMenuId,
    menuPanelOpen,
    setMenuPanelOpen,
    openByMnemonic
  };
};
