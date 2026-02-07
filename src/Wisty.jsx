import { createEffect, createSignal, onCleanup, onMount } from "solid-js";

import { getCurrentWindow } from "@tauri-apps/api/window";
import { save as saveDialog, open as openDialog, message } from "@tauri-apps/plugin-dialog"
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { open as openInDefault } from '@tauri-apps/plugin-shell';
import { type } from "@tauri-apps/plugin-os";
import { getVersion } from "@tauri-apps/api/app"
import { dirname } from "@tauri-apps/api/path";
import { Store } from "@tauri-apps/plugin-store";
const appWindow = getCurrentWindow()

const [platformName, setPlatformName] = createSignal("");
const [version, setVersion] = createSignal("");
setPlatformName(type());
getVersion().then(setVersion);

export default function Wisty() {
  const [startingState, setStartingState] = createSignal("");
  const [textEdited, setTextEdited] = createSignal(false);
  const [currentFilePath, setCurrentFilePath] = createSignal("");
  const [textWrapEnabled, setTextWrapEnabled] = createSignal(true);
  const [textFontClass, setTextFontClass] = createSignal("font-sans");
  const [fontSize, setFontSize] = createSignal(14);
  const [fontSizeEditing, setFontSizeEditing] = createSignal(false);
  const [fontSizeInput, setFontSizeInput] = createSignal("14");
  const [themeMode, setThemeMode] = createSignal("light");
  const [statusBarVisible, setStatusBarVisible] = createSignal(true);
  const [openMenu, setOpenMenu] = createSignal("");
  const [aboutOpen, setAboutOpen] = createSignal(false);
  const [fileName, setFileName] = createSignal("Untitled");
  const [statsText, setStatsText] = createSignal("0 Words, 0 Chars");
  const [storeReady, setStoreReady] = createSignal(false);
  const [lastDirectory, setLastDirectory] = createSignal("");
  const [confirmOpen, setConfirmOpen] = createSignal(false);

  const minimalButton = "disabled:pointer-events-none disabled:opacity-50 rounded px-2 py-0.5 text-sm ring-1 duration-[50ms] hover:shadow select-none w-fit h-fit bg-transparent text-black ring-transparent hover:ring-gray-200 hover:bg-gray-100 active:bg-gray-200 active:ring-gray-200 dark:text-white dark:hover:ring-gray-700 dark:hover:bg-gray-800 dark:active:bg-gray-700 dark:active:ring-gray-700";
  const colouredButton = colour => `disabled:pointer-events-none disabled:opacity-50 rounded px-2 py-0.5 text-sm ring-1 duration-[50ms] hover:shadow select-none w-fit h-fit bg-${colour}-500 text-white ring-${colour}-600 hover:shadow-${colour}-600 active:bg-${colour}-600 dark:bg-${colour}-700 dark:ring-${colour}-600 dark:hover:shadow-${colour}-600 dark:active:bg-${colour}-600`;
  const colouredMinimalButton = colour => `disabled:pointer-events-none disabled:opacity-50 rounded px-2 py-0.5 text-sm ring-1 duration-[50ms] hover:shadow select-none w-fit h-fit bg-transparent text-black ring-transparent hover:shadow-none hover:ring-${colour}-600 hover:bg-${colour}-500 active:bg-${colour}-600 active:ring-${colour}-600 dark:text-white dark:hover:ring-${colour}-600 dark:hover:bg-${colour}-700 dark:active:ring-${colour}-600 dark:active:bg-${colour}-600`

  const headerTextColour = "!text-gray-700 dark:!text-gray-300 select-none truncate";
  const menuButton = "rounded px-2 py-1 text-sm font-normal select-none text-black hover:bg-gray-200 dark:text-white dark:hover:bg-gray-700";
  const menuItem = "w-full text-left px-3 py-1.5 text-sm text-black hover:bg-gray-100 dark:text-white dark:hover:bg-gray-700 flex items-center justify-between gap-6";
  const menuRowTight = "flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-sm text-black dark:text-white";
  const menuArrow = "flex h-6 w-6 items-center justify-center rounded bg-gray-200/80 text-gray-700 hover:bg-gray-300 active:bg-gray-400 focus:outline-none focus:ring-0 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 dark:active:bg-gray-500";
  const menuPanel = "absolute left-0 top-full mt-0 w-max rounded border border-gray-200 bg-white shadow-md dark:border-gray-700 dark:bg-gray-800 flex flex-col z-50";
  const menuShortcut = "text-sm text-gray-400 dark:text-gray-500";

  let textEditor;
  let menuBar;
  let fontSizeInputRef;
  let settingsStore;
  let unlistenClose;
  let confirmResolve;
  let confirmPromise;
  function calculateStats() {
    var words = textEditor.value.trim().replace("\n", " ").split(/(\s+)/).filter((word) => word.trim().length > 0).length;
    var characters = textEditor.value.replace("\n", "").replace(" ", "").length;
    setStatsText(`${words} Words, ${characters} Characters`);

    setTextEdited(!(textEditor.value === startingState()));
  }
  
  const getFileNameFromPath = (filePath) => filePath.replace(/^.*(\\|\/|\:)/, "");

  const confirmDiscard = async () => {
    if (confirmPromise) {
      return confirmPromise;
    }
    confirmPromise = new Promise((resolve) => {
      confirmResolve = resolve;
      setConfirmOpen(true);
    });
    return confirmPromise;
  };

  const resolveConfirm = (value) => {
    if (confirmResolve) {
      confirmResolve(value);
    }
    confirmResolve = null;
    confirmPromise = null;
    setConfirmOpen(false);
  }

  const discardQuery = async (good) => {
    const shouldDiscard = await confirmDiscard();
    if (shouldDiscard) {
      await good();
    } else {
      focusEditor();
    }
  }

  const closeAbout = () => {
    setAboutOpen(false);
    focusEditor();
  }

  const cleanupCloseListener = () => {
    if (unlistenClose) {
      unlistenClose();
      unlistenClose = null;
    }
  }



  const recordLastDirectory = async (filePath) => {
    if (!filePath) {
      return;
    }
    try {
      const directory = await dirname(filePath);
      setLastDirectory(directory);
      if (settingsStore) {
        await settingsStore.set("lastDirectory", directory);
        await settingsStore.save();
      }
    } catch {
      // ignore directory lookup failures
    }
  }

  const saveFileAs = () => {
    return saveDialog({ defaultPath: lastDirectory() || undefined }).then((filePath) => {
      if (!filePath) {
        focusEditor();
        return;
      }
      writeTextFile(filePath, textEditor.value).then(
        () => {
          setFileName(getFileNameFromPath(filePath));
          setCurrentFilePath(filePath);
          setTextEdited(false);
          setStartingState(textEditor.value);
          void recordLastDirectory(filePath);
          focusEditor();
        },
        () => void message("Error while saving, please try again.").then(focusEditor));
    }, 
    () => void message("Error while saving, please try again.").then(focusEditor));
  }

  const saveFile = () => {
    if (currentFilePath() !== "") {
      return new Promise((success, failure) => {
        writeTextFile(currentFilePath(), textEditor.value).then(
          () => {
            setTextEdited(false);
            setStartingState(textEditor.value);
            void recordLastDirectory(currentFilePath());
            focusEditor();
            success();
          },
          () => {
            failure();
            void message("Error while saving, please try again.").then(focusEditor)
          }
        );
      })
    } else {
      return saveFileAs();
    }
  }

  const clear = () => {
    textEditor.value = "";
    setStartingState("")
    setCurrentFilePath("");
    setFileName("Untitled");
    setTextEdited(false);
    calculateStats();
  }

  const focusEditor = () => {
    if (textEditor) {
      textEditor.focus();
    }
  }

  const newFile = () => {
    if (textEdited() === false) {
      clear();
      focusEditor();
    } else {
      void discardQuery(clear);
    }
  }

  const open = () => {
    return openDialog({ defaultPath: lastDirectory() || undefined }).then((filePath) => {
      const resolvedPath = Array.isArray(filePath) ? filePath[0] : filePath;
      if (!resolvedPath) {
        focusEditor();
        return;
      }
      clear();
      readTextFile(resolvedPath).then((text) => {
        setStartingState(text);
        textEditor.value = text;
        setCurrentFilePath(resolvedPath);
        setFileName(getFileNameFromPath(resolvedPath));
        void recordLastDirectory(resolvedPath);
        calculateStats(); // Update words and characters (It should be 0, however its best to run the function)
        focusEditor();
      }, () => void message("Error while opening file, please try again.").then(focusEditor));
    }, 
    () => void message("Error while opening file, please try again.").then(focusEditor));
  }

  const openFile = () => {
    if (textEdited() === false) {
      open();
    } else {
      void discardQuery(open);
    }
  }

  const closeApplication = () => {
    appWindow.close();
  }

  const toggleMenu = (menuName) => {
    setOpenMenu(openMenu() === menuName ? "" : menuName);
  }

  const closeMenu = () => {
    setOpenMenu("");
    setFontSizeEditing(false);
  }

  const adjustFontSize = (delta) => {
    const nextSize = Math.min(48, Math.max(8, fontSize() + delta));
    setFontSize(nextSize);
    setFontSizeInput(String(nextSize));
  }

  const commitFontSizeInput = () => {
    const parsed = Number.parseInt(fontSizeInput(), 10);
    const safeSize = Number.isNaN(parsed) ? fontSize() : parsed;
    const clamped = Math.min(48, Math.max(8, safeSize));
    setFontSize(clamped);
    setFontSizeInput(String(clamped));
    setFontSizeEditing(false);
  }

  const handleMenuLeave = (event) => {
    if (fontSizeEditing()) {
      return;
    }
    if (menuBar && event.relatedTarget && menuBar.contains(event.relatedTarget)) {
      return;
    }
    closeMenu();
  }

  const switchMenuOnHover = (menuName) => {
    if (openMenu() !== "" && openMenu() !== menuName) {
      setOpenMenu(menuName);
    }
  }

  const applyThemeMode = (mode) => {
    const root = document.querySelector("html");
    if (!root) {
      return;
    }
    if (mode === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    setThemeMode(mode);
  }

  const cycleFontStyle = () => {
    const current = textFontClass();
    if (current === "font-sans") {
      setTextFontClass("font-serif");
      return;
    }
    if (current === "font-serif") {
      setTextFontClass("font-mono");
      return;
    }
    setTextFontClass("font-sans");
  }

  onMount(() => {
    const handleKeyDown = (event) => {
      if (confirmOpen() && event.key === "Escape") {
        event.preventDefault();
        resolveConfirm(false);
        return;
      }
      if (confirmOpen()) {
        return;
      }
      if (event.key === "Escape" && aboutOpen()) {
        closeAbout();
        return;
      }
      const key = event.key.toLowerCase();
      if (event.ctrlKey && key === "n") {
        event.preventDefault();
        newFile();
        return;
      }
      if (event.ctrlKey && key === "o") {
        event.preventDefault();
        openFile();
        return;
      }
      if (event.ctrlKey && !event.shiftKey && key === "s") {
        event.preventDefault();
        void saveFile();
        return;
      }
      if (event.ctrlKey && event.shiftKey && key === "s") {
        event.preventDefault();
        void saveFileAs();
        return;
      }
      if (event.ctrlKey && key === "q") {
        event.preventDefault();
        closeApplication();
        return;
      }
      if (event.ctrlKey && key === "b") {
        event.preventDefault();
        cycleFontStyle();
        return;
      }
      if (event.ctrlKey && key === "m") {
        event.preventDefault();
        applyThemeMode(themeMode() === "dark" ? "light" : "dark");
        return;
      }
      if (event.ctrlKey && key === "j") {
        event.preventDefault();
        setTextWrapEnabled(!textWrapEnabled());
        return;
      }
      if (event.ctrlKey && key === "u") {
        event.preventDefault();
        setStatusBarVisible(!statusBarVisible());
        return;
      }
      if (event.key === "F1") {
        event.preventDefault();
        setAboutOpen(true);
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    const initStore = async () => {
      settingsStore = await Store.load("settings.json");
      try {
        const storedFontSize = await settingsStore.get("fontSize");
        const storedFontClass = await settingsStore.get("fontFamily");
        const storedStatusBar = await settingsStore.get("statusBarVisible");
        const storedTextWrap = await settingsStore.get("textWrapEnabled");
        const storedThemeMode = await settingsStore.get("themeMode");
        const storedLastDirectory = await settingsStore.get("lastDirectory");
        if (typeof storedFontSize === "number" && Number.isFinite(storedFontSize)) {
          setFontSize(storedFontSize);
          setFontSizeInput(String(storedFontSize));
        }
        if (typeof storedFontClass === "string") {
          setTextFontClass(storedFontClass);
        }
        if (typeof storedStatusBar === "boolean") {
          setStatusBarVisible(storedStatusBar);
        }
        if (typeof storedTextWrap === "boolean") {
          setTextWrapEnabled(storedTextWrap);
        }
        if (storedThemeMode === "dark" || storedThemeMode === "light") {
          applyThemeMode(storedThemeMode);
        } else {
          const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          applyThemeMode(prefersDark ? "dark" : "light");
        }
        if (typeof storedLastDirectory === "string") {
          setLastDirectory(storedLastDirectory);
        }
      } catch {
        // ignore store read failures
      }
      setStoreReady(true);
    };
    void initStore();

    setTimeout(() => {
      if (textEditor) {
        textEditor.focus();
      }
    }, 0);

    const setupCloseListener = async () => {
      unlistenClose = await appWindow.onCloseRequested(async (event) => {
        if (!textEdited()) {
          return;
        }
        const shouldDiscard = await confirmDiscard();
        if (!shouldDiscard) {
          event.preventDefault();
          focusEditor();
        }
      });
    };
    void setupCloseListener();

    onCleanup(() => {
      window.removeEventListener("keydown", handleKeyDown);
      cleanupCloseListener();
    });
  });

  createEffect(() => {
    if (fontSizeEditing() && fontSizeInputRef) {
      fontSizeInputRef.focus();
      fontSizeInputRef.select();
    }
  });

  createEffect(() => {
    if (!storeReady() || !settingsStore) {
      return;
    }
    void settingsStore.set("fontSize", fontSize());
    void settingsStore.save();
  });

  createEffect(() => {
    if (!storeReady() || !settingsStore) {
      return;
    }
    void settingsStore.set("fontFamily", textFontClass());
    void settingsStore.save();
  });

  createEffect(() => {
    if (!storeReady() || !settingsStore) {
      return;
    }
    void settingsStore.set("statusBarVisible", statusBarVisible());
    void settingsStore.save();
  });

  createEffect(() => {
    if (!storeReady() || !settingsStore) {
      return;
    }
    void settingsStore.set("textWrapEnabled", textWrapEnabled());
    void settingsStore.save();
  });

  createEffect(() => {
    if (!storeReady() || !settingsStore) {
      return;
    }
    void settingsStore.set("themeMode", themeMode());
    void settingsStore.save();
  });

  return (
    <div class="relative flex flex-col flex-grow h-full border border-gray-200 dark:border-gray-700" onClick={closeMenu}>
      <div className="flex flex-row items-center h-9 px-2 border-b border-gray-200 dark:border-gray-700 bg-gray-100/70 dark:bg-gray-800/70" onClick={(event) => event.stopPropagation()}>
        <div ref={menuBar} className="flex flex-row items-center whitespace-nowrap space-x-1" onMouseLeave={handleMenuLeave}>
          <div className="relative">
            <button className={menuButton} onClick={() => toggleMenu("file")} onMouseEnter={() => switchMenuOnHover("file")}>File</button>
            {openMenu() === "file" ?
              <div className={menuPanel}>
                <button className={menuItem} onClick={() => { openFile(); closeMenu(); }}>
                  <span>Open</span>
                  <span className={menuShortcut}>Ctrl+O</span>
                </button>
                <button className={menuItem} onClick={() => { newFile(); closeMenu(); }}>
                  <span>New</span>
                  <span className={menuShortcut}>Ctrl+N</span>
                </button>
                <button className={menuItem} onClick={() => { saveFile(); closeMenu(); }}>
                  <span>Save</span>
                  <span className={menuShortcut}>Ctrl+S</span>
                </button>
                <button className={menuItem} onClick={() => { saveFileAs(); closeMenu(); }}>
                  <span>Save As</span>
                  <span className={menuShortcut}>Ctrl+Shift+S</span>
                </button>
                <button className={menuItem} onClick={() => { closeApplication(); closeMenu(); }}>
                  <span>Quit</span>
                  <span className={menuShortcut}>Ctrl+Q</span>
                </button>
              </div>
            : null}
          </div>

          <div className="relative">
            <button className={menuButton} onClick={() => toggleMenu("font")} onMouseEnter={() => switchMenuOnHover("font")}>Font</button>
            {openMenu() === "font" ?
              <div className={menuPanel}>
                <button className={menuItem} onClick={() => { setTextFontClass("font-sans"); closeMenu(); }}>
                  <span>Sans{textFontClass() === "font-sans" ? " ✓" : ""}</span>
                  <span className={menuShortcut}>Ctrl+B</span>
                </button>
                <button className={menuItem} onClick={() => { setTextFontClass("font-serif"); closeMenu(); }}>
                  <span>Serif{textFontClass() === "font-serif" ? " ✓" : ""}</span>
                  <span className={menuShortcut}>Ctrl+B</span>
                </button>
                <button className={menuItem} onClick={() => { setTextFontClass("font-mono"); closeMenu(); }}>
                  <span>Mono{textFontClass() === "font-mono" ? " ✓" : ""}</span>
                  <span className={menuShortcut}>Ctrl+B</span>
                </button>
                <div className={menuRowTight}>
                  <button className={menuArrow} onClick={() => adjustFontSize(-1)} aria-label="Decrease font size">
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                  </button>
                  {fontSizeEditing() ?
                    <input
                      className="min-w-[44px] flex-1 rounded border border-gray-200 bg-white px-1 text-center text-sm text-gray-900 outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                      type="text"
                      inputMode="numeric"
                      ref={fontSizeInputRef}
                      value={fontSizeInput()}
                      onInput={(event) => setFontSizeInput(event.currentTarget.value)}
                      onBlur={commitFontSizeInput}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          commitFontSizeInput();
                          closeMenu();
                        } else if (event.key === "Escape") {
                          setFontSizeInput(String(fontSize()));
                          setFontSizeEditing(false);
                        }
                      }}
                      aria-label="Font size"
                    />
                  :
                    <button
                      className="min-w-[44px] flex-1 text-center text-sm text-gray-700 hover:text-gray-900 dark:text-gray-200 dark:hover:text-white"
                      onClick={() => setFontSizeEditing(true)}
                      aria-label="Edit font size"
                    >
                      {fontSize()} px
                    </button>
                  }
                  <button className={menuArrow} onClick={() => adjustFontSize(1)} aria-label="Increase font size">
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                </div>
              </div>
            : null}
          </div>

          <div className="relative">
            <button className={menuButton} onClick={() => toggleMenu("settings")} onMouseEnter={() => switchMenuOnHover("settings")}>Settings</button>
            {openMenu() === "settings" ?
              <div className={menuPanel}>
                <button className={menuItem} onClick={() => { setTextWrapEnabled(!textWrapEnabled()); closeMenu(); }}>
                  <span>Text Wrap{textWrapEnabled() ? " ✓" : ""}</span>
                  <span className={menuShortcut}>Ctrl+J</span>
                </button>
                <button className={menuItem} onClick={() => { applyThemeMode("dark"); closeMenu(); }}>
                  <span>Dark Mode{themeMode() === "dark" ? " ✓" : ""}</span>
                  <span className={menuShortcut}>Ctrl+M</span>
                </button>
                <button className={menuItem} onClick={() => { applyThemeMode("light"); closeMenu(); }}>
                  <span>Light Mode{themeMode() === "light" ? " ✓" : ""}</span>
                  <span className={menuShortcut}>Ctrl+M</span>
                </button>
                <button className={menuItem} onClick={() => { setStatusBarVisible(!statusBarVisible()); closeMenu(); }}>
                  <span>Status Bar{statusBarVisible() ? " ✓" : ""}</span>
                  <span className={menuShortcut}>Ctrl+U</span>
                </button>
              </div>
            : null}
          </div>

          <div className="relative">
            <button className={menuButton} onClick={() => toggleMenu("app")} onMouseEnter={() => switchMenuOnHover("app")}>App</button>
            {openMenu() === "app" ?
              <div className={menuPanel}>
                <button className={menuItem} onClick={() => { setAboutOpen(true); closeMenu(); }}>
                  <span>About</span>
                  <span className={menuShortcut}>F1</span>
                </button>
              </div>
            : null}
          </div>
        </div>

      </div>

      <div className="flex-1 min-h-0 w-[100%] text-black dark:text-white text-sm overflow-hidden relative">
        <textarea spellCheck={false} onInput={() => { calculateStats(); setTextEdited(true) }} wrap={textWrapEnabled() ? "on" : "off"} ref={textEditor} class={`p-3 w-full h-full outline-none resize-none bg-transparent cursor-auto overflow-auto ${textFontClass()}`} style={{ "font-size": `${fontSize()}px`, "line-height": "1.4" }}/>
      </div>

      {statusBarVisible() ?
        <div className="flex flex-row items-center h-8 px-2 border-t border-gray-200 dark:border-gray-700 bg-gray-100/70 dark:bg-gray-800/70 text-xs">
          <span className="w-fit truncate text-gray-700 dark:text-gray-300">
            {textEdited() ?
              <i>
                {fileName()}
              </i>
            :
              <>
                {fileName()}
              </>
            }
          </span>

          <div class="w-[1px] bg-gray-200 dark:bg-gray-700 !mx-2 !my-1"/>

          <span className="w-fit truncate font-thin text-gray-700 dark:text-gray-300">{statsText()}</span>
        </div>
      : null}

       {confirmOpen() ?
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
           <div className="w-[360px] rounded border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-800" onClick={(event) => event.stopPropagation()}>
             <div className="flex flex-row items-start">
               <div className="flex-1">
                 <div className="text-base font-semibold text-gray-900 dark:text-gray-100">Warning</div>
                 <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">You have unsaved changes</div>
               </div>
             </div>
             <div className="mt-4 flex flex-row items-center justify-end gap-2">
               <button className={minimalButton} onClick={() => resolveConfirm(false)}>Cancel</button>
               <button className={colouredButton("red")} onClick={() => resolveConfirm(true)}>Discard</button>
             </div>
           </div>
         </div>
       : null}

       {aboutOpen() ?
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={closeAbout}>
           <div className="w-[360px] rounded border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-800" onClick={(event) => event.stopPropagation()}>
            <div className="flex flex-row items-start">
              <div className="mr-auto">
                <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">Wisty</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Version {version()}</div>
              </div>
              <button className={`${minimalButton} ${headerTextColour}`} onClick={closeAbout}>Close</button>
            </div>

            <div className="mt-3 space-y-1 text-sm text-gray-700 dark:text-gray-300">
              <div>License: GPL-3.0</div>
              <div>Platform: {platformName()}</div>
              <div>Copyright 2026</div>
            </div>

            <div className="mt-4 flex flex-row items-center">
              <button className={`${colouredButton("blue")}`} onClick={() => openInDefault("https://github.com/timothy-strange/wisty")}>GitHub Repo</button>
            </div>
          </div>
        </div>
      : null}
    </div>
  )
}
