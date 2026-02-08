import { createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import { menuArrow, menuButton, menuItem, menuPanel, menuRowTight, menuShortcut } from "../../constants/ui";
import { ddebug } from "../../lib/debugLog";
import { shortcut } from "../../lib/shortcuts";

const renderMenuLabel = (label, shortcutChar, menuAltActive) => {
  if (!menuAltActive) {
    return label;
  }
  const index = label.toLowerCase().indexOf(shortcutChar.toLowerCase());
  if (index === -1) {
    return label;
  }
  return (
    <span>
      {label.slice(0, index)}
      <span className="underline">{label.slice(index, index + 1)}</span>
      {label.slice(index + 1)}
    </span>
  );
};

export default function MenuBar(props) {
  const menuOrder = ["file", "edit", "font", "settings", "app"];
  const subMenuPanel = "absolute left-full top-0 w-max rounded border border-gray-200 bg-white shadow-md dark:border-gray-700 dark:bg-gray-800 flex flex-col z-50";
  const compactArrowButton = "flex h-5 w-5 items-center justify-center rounded bg-gray-200/80 text-gray-700 hover:bg-gray-300 active:bg-gray-400 focus:outline-none focus:ring-0 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 dark:active:bg-gray-500";
  const [activeItemIndex, setActiveItemIndex] = createSignal(0);
  const [openSubmenu, setOpenSubmenu] = createSignal("");
  const [activeSubItemIndex, setActiveSubItemIndex] = createSignal(0);

  const statusBarSubmenuOpen = () => props.openMenu() === "settings" && openSubmenu() === "status-bar";
  const findReplaceSubmenuOpen = () => props.openMenu() === "settings" && openSubmenu() === "find-replace";
  const anySettingsSubmenuOpen = () => statusBarSubmenuOpen() || findReplaceSubmenuOpen();

  const closeSettingsSubmenu = () => {
    setOpenSubmenu("");
    setActiveSubItemIndex(0);
    props.setStatusBarFontSizeEditing(false);
    props.setFindReplaceFontSizeEditing(false);
  };

  const openStatusBarSubmenu = (source) => {
    if (props.openMenu() !== "settings") {
      return;
    }
    props.setFindReplaceFontSizeEditing(false);
    setOpenSubmenu("status-bar");
    setActiveSubItemIndex(0);
    ddebug("shortcut", "status-bar submenu opened", { source });
  };

  const openFindReplaceSubmenu = (source) => {
    if (props.openMenu() !== "settings") {
      return;
    }
    props.setStatusBarFontSizeEditing(false);
    setOpenSubmenu("find-replace");
    setActiveSubItemIndex(0);
    ddebug("shortcut", "find-replace submenu opened", { source });
  };

  const selectableItemsByMenu = createMemo(() => ({
    file: [
      { id: "open", run: () => { props.openFile(); props.closeMenu(); } },
      { id: "new", run: () => { props.newFile(); props.closeMenu(); } },
      { id: "save", run: () => { props.saveFile(); props.closeMenu(); } },
      { id: "save-as", run: () => { props.saveFileAs(); props.closeMenu(); } },
      { id: "quit", run: () => { props.closeApplication(); props.closeMenu(); } }
    ],
    edit: [
      { id: "undo", run: () => { props.undoInDocument(); props.closeMenu(); } },
      { id: "redo", run: () => { props.redoInDocument(); props.closeMenu(); } },
      { id: "cut", run: () => { props.cutInDocument(); props.closeMenu(); } },
      { id: "copy", run: () => { props.copyInDocument(); props.closeMenu(); } },
      { id: "paste", run: () => { props.pasteInDocument(); props.closeMenu(); } },
      { id: "find", run: () => { props.findInDocument(); props.closeMenu(); } },
      { id: "replace", run: () => { props.replaceInDocument(); props.closeMenu(); } }
    ],
    font: [
      { id: "font-sans", run: () => { props.setTextFontClass("font-sans"); props.closeMenu(); } },
      { id: "font-serif", run: () => { props.setTextFontClass("font-serif"); props.closeMenu(); } },
      { id: "font-mono", run: () => { props.setTextFontClass("font-mono"); props.closeMenu(); } },
      {
        id: "font-size",
        run: () => {
          const nextEditing = !props.fontSizeEditing();
          if (nextEditing) {
            props.setFontSizeInput(String(props.fontSize()));
          }
          props.setFontSizeEditing(nextEditing);
          ddebug("shortcut", "font-size edit toggled by enter", { editing: nextEditing });
        }
      }
    ],
    settings: [
      { id: "text-wrap", run: () => { props.setTextWrapEnabled(!props.textWrapEnabled()); props.closeMenu(); } },
      { id: "dark-mode", run: () => { props.applyThemeMode("dark"); props.closeMenu(); } },
      { id: "light-mode", run: () => { props.applyThemeMode("light"); props.closeMenu(); } },
      { id: "highlight-matches", run: () => { props.setHighlightSelectionMatchesEnabled(!props.highlightSelectionMatchesEnabled()); props.closeMenu(); } },
      { id: "highlight-current-line", run: () => { props.setHighlightCurrentLineEnabled(!props.highlightCurrentLineEnabled()); props.closeMenu(); } },
      { id: "find-replace-submenu", run: () => openFindReplaceSubmenu("enter-parent") },
      { id: "status-bar-submenu", run: () => openStatusBarSubmenu("enter-parent") }
    ],
    app: [
      { id: "about", run: () => { props.setAboutOpen(true); props.closeMenu(); } }
    ]
  }));

  const getSelectableItems = () => selectableItemsByMenu()[props.openMenu()] || [];

  const itemClass = (menuName, index) => {
    const active = props.openMenu() === menuName && activeItemIndex() === index;
    return active ? `${menuItem} bg-gray-100 dark:bg-gray-700` : menuItem;
  };

  const rowClass = (menuName, index) => {
    const active = props.openMenu() === menuName && activeItemIndex() === index;
    return active ? `${menuRowTight} bg-gray-100 dark:bg-gray-700` : menuRowTight;
  };

  const subItemClass = (index) => {
    const active = statusBarSubmenuOpen() && activeSubItemIndex() === index;
    return active ? `${menuItem} bg-gray-100 dark:bg-gray-700` : menuItem;
  };

  const subRowClass = (index) => {
    const active = anySettingsSubmenuOpen() && activeSubItemIndex() === index;
    return active ? `${menuRowTight} bg-gray-100 dark:bg-gray-700` : menuRowTight;
  };

  const isFontSizeRowSelected = () => {
    if (props.openMenu() !== "font") {
      return false;
    }
    const items = getSelectableItems();
    const selected = items[activeItemIndex()];
    return selected && selected.id === "font-size";
  };

  const isStatusBarFontSizeSubRowSelected = () => statusBarSubmenuOpen() && activeSubItemIndex() === 2;
  const isFindReplaceFontSizeSubRowSelected = () => findReplaceSubmenuOpen() && activeSubItemIndex() === 0;

  const toggleStatusBarFontSizeEdit = () => {
    const nextEditing = !props.statusBarFontSizeEditing();
    if (nextEditing) {
      props.setStatusBarFontSizeInput(String(props.statusBarFontSize()));
    }
    props.setStatusBarFontSizeEditing(nextEditing);
    ddebug("shortcut", "status-bar font-size edit toggled by enter", { editing: nextEditing });
  };

  const toggleFindReplaceFontSizeEdit = () => {
    const nextEditing = !props.findReplaceFontSizeEditing();
    if (nextEditing) {
      props.setFindReplaceFontSizeInput(String(props.findReplaceFontSize()));
    }
    props.setFindReplaceFontSizeEditing(nextEditing);
    ddebug("shortcut", "find-replace font-size edit toggled by enter", { editing: nextEditing });
  };

  const moveMenuBy = (delta) => {
    closeSettingsSubmenu();
    const currentMenu = props.openMenu();
    if (!currentMenu) {
      return;
    }
    const currentIndex = menuOrder.indexOf(currentMenu);
    if (currentIndex === -1) {
      return;
    }
    const nextIndex = (currentIndex + delta + menuOrder.length) % menuOrder.length;
    const nextMenu = menuOrder[nextIndex];
    props.toggleMenu(nextMenu);
    setActiveItemIndex(0);
    ddebug("shortcut", "menu switched by arrow", { from: currentMenu, to: nextMenu, delta });
  };

  const moveItemBy = (delta) => {
    closeSettingsSubmenu();
    const items = getSelectableItems();
    if (items.length === 0) {
      return;
    }
    const from = activeItemIndex();
    const nextIndex = (from + delta + items.length) % items.length;
    setActiveItemIndex(nextIndex);
    ddebug("shortcut", "menu item moved by arrow", { menu: props.openMenu(), from, to: nextIndex, delta });
  };

  const moveSubItemBy = (delta) => {
    const total = statusBarSubmenuOpen() ? 3 : 1;
    const from = activeSubItemIndex();
    const nextIndex = (from + delta + total) % total;
    setActiveSubItemIndex(nextIndex);
    ddebug("shortcut", "status-bar submenu item moved by arrow", { from, to: nextIndex, delta });
  };

  const activateStatusBarSubmenuItem = () => {
    const index = activeSubItemIndex();
    if (index === 0) {
      props.setStatusBarVisible(!props.statusBarVisible());
      ddebug("shortcut", "status-bar enabled toggled", { enabled: !props.statusBarVisible() });
      return;
    }
    if (index === 1) {
      props.setStatusBarStatsVisible(!props.statusBarStatsVisible());
      ddebug("shortcut", "status-bar show-stats toggled", { showStats: !props.statusBarStatsVisible() });
      return;
    }
    if (index === 2) {
      toggleStatusBarFontSizeEdit();
    }
  };

  const activateSelectedItem = () => {
    if (statusBarSubmenuOpen()) {
      activateStatusBarSubmenuItem();
      return;
    }
    const items = getSelectableItems();
    if (items.length === 0) {
      return;
    }
    const index = Math.min(Math.max(activeItemIndex(), 0), items.length - 1);
    const selected = items[index];
    if (!selected) {
      return;
    }
    ddebug("shortcut", "menu item activated by enter", { menu: props.openMenu(), index, itemId: selected.id });
    selected.run();
  };

  createEffect(() => {
    const currentMenu = props.openMenu();
    if (!currentMenu) {
      closeSettingsSubmenu();
      return;
    }
    setActiveItemIndex(0);
    if (currentMenu !== "settings") {
      closeSettingsSubmenu();
    }
  });

  onMount(() => {
    const handleWindowKeyDown = (event) => {
      if (!props.openMenu()) {
        return;
      }

      if (statusBarSubmenuOpen() && props.statusBarFontSizeEditing()) {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          props.setStatusBarFontSizeInput(String(props.statusBarFontSize()));
          props.setStatusBarFontSizeEditing(false);
        }
        return;
      }

      if (findReplaceSubmenuOpen() && props.findReplaceFontSizeEditing()) {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          props.setFindReplaceFontSizeInput(String(props.findReplaceFontSize()));
          props.setFindReplaceFontSizeEditing(false);
        }
        return;
      }

      if (props.fontSizeEditing && props.fontSizeEditing()) {
        return;
      }

      if (event.key === "Escape" && anySettingsSubmenuOpen()) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        const currentSubmenu = openSubmenu();
        closeSettingsSubmenu();
        setActiveItemIndex(currentSubmenu === "find-replace" ? 5 : 6);
        ddebug("shortcut", "settings submenu closed by escape", { submenu: currentSubmenu });
        return;
      }

      if (anySettingsSubmenuOpen()) {
        if (event.key === "ArrowUp") {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          moveSubItemBy(-1);
          return;
        }
        if (event.key === "ArrowDown") {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          moveSubItemBy(1);
          return;
        }
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          if (isStatusBarFontSizeSubRowSelected()) {
            props.adjustStatusBarFontSize(-1);
            return;
          }
          if (isFindReplaceFontSizeSubRowSelected()) {
            props.adjustFindReplaceFontSize(-1);
            return;
          }
          const currentSubmenu = openSubmenu();
          closeSettingsSubmenu();
          setActiveItemIndex(currentSubmenu === "find-replace" ? 5 : 6);
          return;
        }
        if (event.key === "ArrowRight") {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          if (isStatusBarFontSizeSubRowSelected()) {
            props.adjustStatusBarFontSize(1);
          } else if (isFindReplaceFontSizeSubRowSelected()) {
            props.adjustFindReplaceFontSize(1);
          }
          return;
        }
        if (event.key === "Enter") {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          if (statusBarSubmenuOpen()) {
            activateStatusBarSubmenuItem();
          } else if (findReplaceSubmenuOpen()) {
            toggleFindReplaceFontSizeEdit();
          }
        }
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        if (isFontSizeRowSelected()) {
          props.adjustFontSize(-1);
          ddebug("shortcut", "font-size adjusted by left arrow", { value: props.fontSize() });
          return;
        }
        moveMenuBy(-1);
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        if (props.openMenu() === "settings" && activeItemIndex() === 5) {
          openFindReplaceSubmenu("arrow-right");
          return;
        }
        if (props.openMenu() === "settings" && activeItemIndex() === 6) {
          openStatusBarSubmenu("arrow-right");
          return;
        }
        if (isFontSizeRowSelected()) {
          props.adjustFontSize(1);
          ddebug("shortcut", "font-size adjusted by right arrow", { value: props.fontSize() });
          return;
        }
        moveMenuBy(1);
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        moveItemBy(-1);
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        moveItemBy(1);
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        activateSelectedItem();
      }
    };

    window.addEventListener("keydown", handleWindowKeyDown, true);
    onCleanup(() => {
      window.removeEventListener("keydown", handleWindowKeyDown, true);
    });
  });

  return (
    <div className="flex flex-row items-center h-9 px-2 border-b border-gray-200 dark:border-gray-700 bg-gray-100/70 dark:bg-gray-800/70" onClick={(event) => event.stopPropagation()}>
      <div ref={props.menuBarRef} className="flex flex-row items-center whitespace-nowrap space-x-1" onMouseLeave={props.handleMenuLeave}>
        <div className="relative">
          <button className={menuButton} onClick={() => props.toggleMenu("file")} onMouseEnter={() => props.switchMenuOnHover("file")}>{renderMenuLabel("File", "F", props.menuAltActive())}</button>
          {props.openMenu() === "file" ?
            <div className={menuPanel}>
              <button className={itemClass("file", 0)} onMouseEnter={() => setActiveItemIndex(0)} onClick={() => { props.openFile(); props.closeMenu(); }}>
                <span>Open</span>
                <span className={menuShortcut}>{shortcut(props.platformName(), "O")}</span>
              </button>
              <button className={itemClass("file", 1)} onMouseEnter={() => setActiveItemIndex(1)} onClick={() => { props.newFile(); props.closeMenu(); }}>
                <span>New</span>
                <span className={menuShortcut}>{shortcut(props.platformName(), "N")}</span>
              </button>
              <button className={itemClass("file", 2)} onMouseEnter={() => setActiveItemIndex(2)} onClick={() => { props.saveFile(); props.closeMenu(); }}>
                <span>Save</span>
                <span className={menuShortcut}>{shortcut(props.platformName(), "S")}</span>
              </button>
              <button className={itemClass("file", 3)} onMouseEnter={() => setActiveItemIndex(3)} onClick={() => { props.saveFileAs(); props.closeMenu(); }}>
                <span>Save As</span>
                <span className={menuShortcut}>{shortcut(props.platformName(), "S", true)}</span>
              </button>
              <button className={itemClass("file", 4)} onMouseEnter={() => setActiveItemIndex(4)} onClick={() => { props.closeApplication(); props.closeMenu(); }}>
                <span>Quit</span>
                <span className={menuShortcut}>{shortcut(props.platformName(), "Q")}</span>
              </button>
            </div>
            : null}
        </div>

        <div className="relative">
          <button className={menuButton} onClick={() => props.toggleMenu("edit")} onMouseEnter={() => props.switchMenuOnHover("edit")}>{renderMenuLabel("Edit", "E", props.menuAltActive())}</button>
          {props.openMenu() === "edit" ?
            <div className={menuPanel}>
              <button className={itemClass("edit", 0)} onMouseEnter={() => setActiveItemIndex(0)} onClick={() => { props.undoInDocument(); props.closeMenu(); }}>
                <span>Undo</span>
                <span className={menuShortcut}>{shortcut(props.platformName(), "Z")}</span>
              </button>
              <button className={itemClass("edit", 1)} onMouseEnter={() => setActiveItemIndex(1)} onClick={() => { props.redoInDocument(); props.closeMenu(); }}>
                <span>Redo</span>
                <span className={menuShortcut}>{shortcut(props.platformName(), "Z", true)}</span>
              </button>
              <button className={itemClass("edit", 2)} onMouseEnter={() => setActiveItemIndex(2)} onClick={() => { props.cutInDocument(); props.closeMenu(); }}>
                <span>Cut</span>
                <span className={menuShortcut}>{shortcut(props.platformName(), "X")}</span>
              </button>
              <button className={itemClass("edit", 3)} onMouseEnter={() => setActiveItemIndex(3)} onClick={() => { props.copyInDocument(); props.closeMenu(); }}>
                <span>Copy</span>
                <span className={menuShortcut}>{shortcut(props.platformName(), "C")}</span>
              </button>
              <button className={itemClass("edit", 4)} onMouseEnter={() => setActiveItemIndex(4)} onClick={() => { props.pasteInDocument(); props.closeMenu(); }}>
                <span>Paste</span>
                <span className={menuShortcut}>{shortcut(props.platformName(), "V")}</span>
              </button>
              <button className={itemClass("edit", 5)} onMouseEnter={() => setActiveItemIndex(5)} onClick={() => { props.findInDocument(); props.closeMenu(); }}>
                <span>Find</span>
                <span className={menuShortcut}>{shortcut(props.platformName(), "F")}</span>
              </button>
              <button className={itemClass("edit", 6)} onMouseEnter={() => setActiveItemIndex(6)} onClick={() => { props.replaceInDocument(); props.closeMenu(); }}>
                <span>Replace</span>
                <span className={menuShortcut}>{shortcut(props.platformName(), "H")}</span>
              </button>
            </div>
            : null}
        </div>

        <div className="relative">
          <button className={menuButton} onClick={() => props.toggleMenu("font")} onMouseEnter={() => props.switchMenuOnHover("font")}>{renderMenuLabel("Font", "O", props.menuAltActive())}</button>
          {props.openMenu() === "font" ?
            <div className={menuPanel}>
              <button className={itemClass("font", 0)} onMouseEnter={() => setActiveItemIndex(0)} onClick={() => { props.setTextFontClass("font-sans"); props.closeMenu(); }}>
                <span>Sans{props.textFontClass() === "font-sans" ? " ✓" : ""}</span>
                <span className={menuShortcut}>{shortcut(props.platformName(), "B")}</span>
              </button>
              <button className={itemClass("font", 1)} onMouseEnter={() => setActiveItemIndex(1)} onClick={() => { props.setTextFontClass("font-serif"); props.closeMenu(); }}>
                <span>Serif{props.textFontClass() === "font-serif" ? " ✓" : ""}</span>
                <span className={menuShortcut}>{shortcut(props.platformName(), "B")}</span>
              </button>
              <button className={itemClass("font", 2)} onMouseEnter={() => setActiveItemIndex(2)} onClick={() => { props.setTextFontClass("font-mono"); props.closeMenu(); }}>
                <span>Mono{props.textFontClass() === "font-mono" ? " ✓" : ""}</span>
                <span className={menuShortcut}>{shortcut(props.platformName(), "B")}</span>
              </button>
              <div className={rowClass("font", 3)} onMouseEnter={() => setActiveItemIndex(3)}>
                <button className={menuArrow} onClick={() => props.adjustFontSize(-1)} aria-label="Decrease font size">
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
                {props.fontSizeEditing() ?
                  <input
                    className="w-12 rounded border border-gray-200 bg-white px-1 text-center text-sm text-gray-900 outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                    type="text"
                    inputMode="numeric"
                    ref={props.fontSizeInputRef}
                    value={props.fontSizeInput()}
                    onInput={(event) => props.setFontSizeInput(event.currentTarget.value)}
                    onBlur={props.commitFontSizeInput}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        props.commitFontSizeInput();
                      } else if (event.key === "Escape") {
                        event.preventDefault();
                        props.setFontSizeInput(String(props.fontSize()));
                        props.setFontSizeEditing(false);
                      }
                    }}
                    aria-label="Font size"
                  />
                  :
                  <button
                    className="w-12 text-center text-sm text-gray-700 hover:text-gray-900 dark:text-gray-200 dark:hover:text-white"
                    onClick={() => props.setFontSizeEditing(true)}
                    aria-label="Edit font size"
                  >
                    {props.fontSize()} px
                  </button>
                }
                <button className={menuArrow} onClick={() => props.adjustFontSize(1)} aria-label="Increase font size">
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>
            </div>
            : null}
        </div>

        <div className="relative">
          <button className={menuButton} onClick={() => props.toggleMenu("settings")} onMouseEnter={() => props.switchMenuOnHover("settings")}>{renderMenuLabel("Settings", "S", props.menuAltActive())}</button>
          {props.openMenu() === "settings" ?
            <div className={menuPanel}>
              <button className={itemClass("settings", 0)} onMouseEnter={() => { setActiveItemIndex(0); closeSettingsSubmenu(); }} onClick={() => { props.setTextWrapEnabled(!props.textWrapEnabled()); props.closeMenu(); }}>
                <span>Text Wrap{props.textWrapEnabled() ? " ✓" : ""}</span>
                <span className={menuShortcut}>{shortcut(props.platformName(), "J")}</span>
              </button>
              <button className={itemClass("settings", 1)} onMouseEnter={() => { setActiveItemIndex(1); closeSettingsSubmenu(); }} onClick={() => { props.applyThemeMode("dark"); props.closeMenu(); }}>
                <span>Dark Mode{props.themeMode() === "dark" ? " ✓" : ""}</span>
                <span className={menuShortcut}>{shortcut(props.platformName(), "M")}</span>
              </button>
              <button className={itemClass("settings", 2)} onMouseEnter={() => { setActiveItemIndex(2); closeSettingsSubmenu(); }} onClick={() => { props.applyThemeMode("light"); props.closeMenu(); }}>
                <span>Light Mode{props.themeMode() === "light" ? " ✓" : ""}</span>
                <span className={menuShortcut}>{shortcut(props.platformName(), "M")}</span>
              </button>
              <button className={itemClass("settings", 3)} onMouseEnter={() => { setActiveItemIndex(3); closeSettingsSubmenu(); }} onClick={() => { const nextValue = !props.highlightSelectionMatchesEnabled(); ddebug("settings", "toggle highlight matches via menu", { nextValue }); props.setHighlightSelectionMatchesEnabled(nextValue); props.closeMenu(); }}>
                <span>Highlight Matches{props.highlightSelectionMatchesEnabled() ? " ✓" : ""}</span>
              </button>
              <button className={itemClass("settings", 4)} onMouseEnter={() => { setActiveItemIndex(4); closeSettingsSubmenu(); }} onClick={() => { const nextValue = !props.highlightCurrentLineEnabled(); ddebug("settings", "toggle highlight current line via menu", { nextValue }); props.setHighlightCurrentLineEnabled(nextValue); props.closeMenu(); }}>
                <span>Highlight Current Line{props.highlightCurrentLineEnabled() ? " ✓" : ""}</span>
              </button>

              <div className="relative">
                <button
                  className={itemClass("settings", 5)}
                  onMouseEnter={() => { setActiveItemIndex(5); openFindReplaceSubmenu("hover-parent"); }}
                  onClick={() => openFindReplaceSubmenu("click-parent")}
                >
                  <span>Find/Replace</span>
                  <span className="pointer-events-none flex items-center text-gray-400 dark:text-gray-500" aria-hidden="true">
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </span>
                </button>
                {findReplaceSubmenuOpen() ?
                  <div className={subMenuPanel} onMouseEnter={() => openFindReplaceSubmenu("hover-submenu")}>
                    <div className={subRowClass(0)} onMouseEnter={() => setActiveSubItemIndex(0)}>
                      <span className="text-sm text-gray-700 dark:text-gray-200">Font</span>
                      <div className="flex items-center gap-2">
                        <button className={compactArrowButton} onClick={() => props.adjustFindReplaceFontSize(-1)} aria-label="Decrease find replace font size">
                          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="15 18 9 12 15 6" />
                          </svg>
                        </button>
                        {props.findReplaceFontSizeEditing() ?
                          <input
                            className="w-12 rounded border border-gray-200 bg-white px-1 text-center text-sm text-gray-900 outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                            type="text"
                            inputMode="numeric"
                            ref={props.findReplaceFontSizeInputRef}
                            value={props.findReplaceFontSizeInput()}
                            onInput={(event) => props.setFindReplaceFontSizeInput(event.currentTarget.value)}
                            onBlur={props.commitFindReplaceFontSizeInput}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                props.commitFindReplaceFontSizeInput();
                              } else if (event.key === "Escape") {
                                event.preventDefault();
                                props.setFindReplaceFontSizeInput(String(props.findReplaceFontSize()));
                                props.setFindReplaceFontSizeEditing(false);
                              }
                            }}
                            aria-label="Find replace font size"
                          />
                          :
                          <button
                            className="w-12 text-center text-sm text-gray-700 hover:text-gray-900 dark:text-gray-200 dark:hover:text-white"
                            onClick={() => toggleFindReplaceFontSizeEdit()}
                            aria-label="Edit find replace font size"
                          >
                            {props.findReplaceFontSize()} px
                          </button>
                        }
                        <button className={compactArrowButton} onClick={() => props.adjustFindReplaceFontSize(1)} aria-label="Increase find replace font size">
                          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                  : null}
              </div>

              <div className="relative">
                <button
                  className={itemClass("settings", 6)}
                  onMouseEnter={() => { setActiveItemIndex(6); openStatusBarSubmenu("hover-parent"); }}
                  onClick={() => openStatusBarSubmenu("click-parent")}
                >
                  <span>Status Bar</span>
                  <span className="pointer-events-none flex items-center text-gray-400 dark:text-gray-500" aria-hidden="true">
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </span>
                </button>
                {statusBarSubmenuOpen() ?
                  <div className={subMenuPanel} onMouseEnter={() => openStatusBarSubmenu("hover-submenu")}>
                    <button className={subItemClass(0)} onMouseEnter={() => { setActiveSubItemIndex(0); props.setStatusBarFontSizeEditing(false); }} onClick={() => props.setStatusBarVisible(!props.statusBarVisible())}>
                      <span>Enabled{props.statusBarVisible() ? " ✓" : ""}</span>
                    </button>
                    <button className={subItemClass(1)} onMouseEnter={() => { setActiveSubItemIndex(1); props.setStatusBarFontSizeEditing(false); }} onClick={() => props.setStatusBarStatsVisible(!props.statusBarStatsVisible())}>
                      <span>Show stats{props.statusBarStatsVisible() ? " ✓" : ""}</span>
                    </button>
                    <div className={subRowClass(2)} onMouseEnter={() => setActiveSubItemIndex(2)}>
                      <span className="text-sm text-gray-700 dark:text-gray-200">Font</span>
                      <div className="flex items-center gap-2">
                        <button className={compactArrowButton} onClick={() => props.adjustStatusBarFontSize(-1)} aria-label="Decrease status bar font size">
                          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="15 18 9 12 15 6" />
                          </svg>
                        </button>
                        {props.statusBarFontSizeEditing() ?
                          <input
                            className="w-12 rounded border border-gray-200 bg-white px-1 text-center text-sm text-gray-900 outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                            type="text"
                            inputMode="numeric"
                            ref={props.statusBarFontSizeInputRef}
                            value={props.statusBarFontSizeInput()}
                            onInput={(event) => props.setStatusBarFontSizeInput(event.currentTarget.value)}
                            onBlur={props.commitStatusBarFontSizeInput}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                props.commitStatusBarFontSizeInput();
                              } else if (event.key === "Escape") {
                                event.preventDefault();
                                props.setStatusBarFontSizeInput(String(props.statusBarFontSize()));
                                props.setStatusBarFontSizeEditing(false);
                              }
                            }}
                            aria-label="Status bar font size"
                          />
                          :
                          <button
                            className="w-12 text-center text-sm text-gray-700 hover:text-gray-900 dark:text-gray-200 dark:hover:text-white"
                            onClick={() => toggleStatusBarFontSizeEdit()}
                            aria-label="Edit status bar font size"
                          >
                            {props.statusBarFontSize()} px
                          </button>
                        }
                        <button className={compactArrowButton} onClick={() => props.adjustStatusBarFontSize(1)} aria-label="Increase status bar font size">
                          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                  : null}
              </div>
            </div>
            : null}
        </div>

        <div className="relative">
          <button className={menuButton} onClick={() => props.toggleMenu("app")} onMouseEnter={() => props.switchMenuOnHover("app")}>{renderMenuLabel("App", "A", props.menuAltActive())}</button>
          {props.openMenu() === "app" ?
            <div className={menuPanel}>
              <button className={itemClass("app", 0)} onMouseEnter={() => setActiveItemIndex(0)} onClick={() => { props.setAboutOpen(true); props.closeMenu(); }}>
                <span>About</span>
                <span className={menuShortcut}>F1</span>
              </button>
            </div>
            : null}
        </div>
      </div>
    </div>
  );
}
