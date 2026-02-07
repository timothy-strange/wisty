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
  const menuOrder = ["file", "font", "settings", "app"];
  const [activeItemIndex, setActiveItemIndex] = createSignal(0);

  const selectableItemsByMenu = createMemo(() => ({
    file: [
      { id: "open", run: () => { props.openFile(); props.closeMenu(); } },
      { id: "new", run: () => { props.newFile(); props.closeMenu(); } },
      { id: "save", run: () => { props.saveFile(); props.closeMenu(); } },
      { id: "save-as", run: () => { props.saveFileAs(); props.closeMenu(); } },
      { id: "quit", run: () => { props.closeApplication(); props.closeMenu(); } }
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
      { id: "status-bar", run: () => { props.setStatusBarVisible(!props.statusBarVisible()); props.closeMenu(); } }
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

  const isFontSizeRowSelected = () => {
    if (props.openMenu() !== "font") {
      return false;
    }
    const items = getSelectableItems();
    const selected = items[activeItemIndex()];
    return selected && selected.id === "font-size";
  };

  const moveMenuBy = (delta) => {
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
    const items = getSelectableItems();
    if (items.length === 0) {
      return;
    }
    const nextIndex = (activeItemIndex() + delta + items.length) % items.length;
    setActiveItemIndex(nextIndex);
    ddebug("shortcut", "menu item moved by arrow", { menu: props.openMenu(), from: activeItemIndex(), to: nextIndex, delta });
  };

  const activateSelectedItem = () => {
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
      return;
    }
    setActiveItemIndex(0);
  });

  onMount(() => {
    const handleWindowKeyDown = (event) => {
      if (!props.openMenu()) {
        return;
      }
      if (props.fontSizeEditing && props.fontSizeEditing()) {
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
                <button className={itemClass("settings", 0)} onMouseEnter={() => setActiveItemIndex(0)} onClick={() => { props.setTextWrapEnabled(!props.textWrapEnabled()); props.closeMenu(); }}>
                  <span>Text Wrap{props.textWrapEnabled() ? " ✓" : ""}</span>
                  <span className={menuShortcut}>{shortcut(props.platformName(), "J")}</span>
                </button>
                <button className={itemClass("settings", 1)} onMouseEnter={() => setActiveItemIndex(1)} onClick={() => { props.applyThemeMode("dark"); props.closeMenu(); }}>
                  <span>Dark Mode{props.themeMode() === "dark" ? " ✓" : ""}</span>
                  <span className={menuShortcut}>{shortcut(props.platformName(), "M")}</span>
                </button>
                <button className={itemClass("settings", 2)} onMouseEnter={() => setActiveItemIndex(2)} onClick={() => { props.applyThemeMode("light"); props.closeMenu(); }}>
                  <span>Light Mode{props.themeMode() === "light" ? " ✓" : ""}</span>
                  <span className={menuShortcut}>{shortcut(props.platformName(), "M")}</span>
                </button>
                <button className={itemClass("settings", 3)} onMouseEnter={() => setActiveItemIndex(3)} onClick={() => { props.setStatusBarVisible(!props.statusBarVisible()); props.closeMenu(); }}>
                  <span>Status Bar{props.statusBarVisible() ? " ✓" : ""}</span>
                  <span className={menuShortcut}>{shortcut(props.platformName(), "U")}</span>
                </button>
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
