import { createEffect, createSignal, onCleanup, onMount } from "solid-js";

import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { save as saveDialog, open as openDialog, ask as askDialog, message } from "@tauri-apps/plugin-dialog"
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { open as openInDefault } from '@tauri-apps/plugin-shell';
import { type } from "@tauri-apps/plugin-os";
import { getVersion } from "@tauri-apps/api/app"
const appWindow = getCurrentWebviewWindow()

const [platformName, setPlatformName] = createSignal("");
const [version, setVersion] = createSignal("");
setPlatformName(type());
getVersion().then(setVersion);

if (window.matchMedia('(prefers-color-scheme: dark)').matches === true) {
  document.querySelector("html").classList.add("dark");
}

window.matchMedia('(prefers-color-scheme: dark)').addEventListener("change", event => {
  if (event.matches) {
    document.querySelector("html").classList.add("dark");
  } else {
    document.querySelector("html").classList.remove("dark");
  }
})

export default function Wisty() {
  const [startingState, setStartingState] = createSignal("");
  const [textEdited, setTextEdited] = createSignal(false);
  const [currentFilePath, setCurrentFilePath] = createSignal("");
  const [textWrapEnabled, setTextWrapEnabled] = createSignal(true);
  const [textFontClass, setTextFontClass] = createSignal("font-sans");
  const [fontSize, setFontSize] = createSignal(14);
  const [fontSizeEditing, setFontSizeEditing] = createSignal(false);
  const [fontSizeInput, setFontSizeInput] = createSignal("14");
  const [fontBold, setFontBold] = createSignal(false);
  const [fontItalic, setFontItalic] = createSignal(false);
  const [fontUnderline, setFontUnderline] = createSignal(false);
  const [statusBarVisible, setStatusBarVisible] = createSignal(true);
  const [openMenu, setOpenMenu] = createSignal("");
  const [aboutOpen, setAboutOpen] = createSignal(false);
  const [fileName, setFileName] = createSignal("Untitled");
  const [statsText, setStatsText] = createSignal("0 Words, 0 Chars");

  const minimalButton = "disabled:pointer-events-none disabled:opacity-50 rounded px-2 py-0.5 text-sm ring-1 duration-[50ms] hover:shadow select-none w-fit h-fit bg-transparent text-black ring-transparent hover:ring-gray-200 hover:bg-gray-100 active:bg-gray-200 active:ring-gray-200 dark:text-white dark:hover:ring-gray-700 dark:hover:bg-gray-800 dark:active:bg-gray-700 dark:active:ring-gray-700";
  const colouredButton = colour => `disabled:pointer-events-none disabled:opacity-50 rounded px-2 py-0.5 text-sm ring-1 duration-[50ms] hover:shadow select-none w-fit h-fit bg-${colour}-500 text-white ring-${colour}-600 hover:shadow-${colour}-600 active:bg-${colour}-600 dark:bg-${colour}-700 dark:ring-${colour}-600 dark:hover:shadow-${colour}-600 dark:active:bg-${colour}-600`;
  const colouredMinimalButton = colour => `disabled:pointer-events-none disabled:opacity-50 rounded px-2 py-0.5 text-sm ring-1 duration-[50ms] hover:shadow select-none w-fit h-fit bg-transparent text-black ring-transparent hover:shadow-none hover:ring-${colour}-600 hover:bg-${colour}-500 active:bg-${colour}-600 active:ring-${colour}-600 dark:text-white dark:hover:ring-${colour}-600 dark:hover:bg-${colour}-700 dark:active:ring-${colour}-600 dark:active:bg-${colour}-600`

  const headerTextColour = "!text-gray-700 dark:!text-gray-300 select-none truncate";
  const menuButton = "rounded px-2 py-1 text-sm font-normal select-none text-black hover:bg-gray-200 dark:text-white dark:hover:bg-gray-700";
  const menuItem = "w-full text-left px-3 py-1.5 text-sm text-black hover:bg-gray-100 dark:text-white dark:hover:bg-gray-700";
  const menuRow = "flex w-full items-center gap-2 px-2.5 py-1.5 text-sm text-black dark:text-white";
  const menuRowTight = "flex w-full items-center gap-1 px-2.5 py-1.5 text-sm text-black dark:text-white";
  const menuRowSpread = "flex w-full items-center justify-between px-3 py-1.5 text-sm text-black dark:text-white";
  const menuArrow = "flex h-6 w-6 items-center justify-center rounded bg-gray-200/80 text-gray-700 hover:bg-gray-300 active:bg-gray-400 focus:outline-none focus:ring-0 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 dark:active:bg-gray-500";
  const toggleButton = (active) => `flex h-6 w-6 items-center justify-center rounded border text-xs font-semibold ${active ? "bg-gray-300 border-gray-300 text-gray-900 dark:bg-gray-600 dark:border-gray-500 dark:text-white" : "bg-gray-100 border-gray-200 text-gray-700 hover:bg-gray-200 active:bg-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-600 dark:active:bg-gray-500"}`;
  const menuPanel = "absolute left-0 top-full mt-0 w-max rounded border border-gray-200 bg-white shadow-md dark:border-gray-700 dark:bg-gray-800 flex flex-col z-50";

  let textEditor;
  let menuBar;
  let fontSizeInputRef;
  function calculateStats() {
    var words = textEditor.value.trim().replace("\n", " ").split(/(\s+)/).filter((word) => word.trim().length > 0).length;
    var characters = textEditor.value.replace("\n", "").replace(" ", "").length;
    setStatsText(`${words} Words, ${characters} Characters`);

    setTextEdited(!(textEditor.value === startingState()));

    console.log(textEdited())
  }
  
  const getFileNameFromPath = (filePath) => filePath.replace(/^.*(\\|\/|\:)/, "");

  const discardQuery = (good, badToastMessage) => {
    askDialog("Would you like to discard your work?").then((yes) => {
      if (yes) {
        good();
      } else {
        message(badToastMessage);
      }
    })
  }

  const saveFileAs = () => {
    return saveDialog().then((filePath) => {
      if (!filePath) {
        return;
      }
      writeTextFile(filePath, textEditor.value).then(
        () => {
          setFileName(getFileNameFromPath(filePath));
          setCurrentFilePath(filePath);
          setTextEdited(false);
          setStartingState(textEditor.value);
        },
        () => message("Error while saving, please try again."));
    }, 
    () => message("Error while saving, please try again."));
  }

  const saveFile = () => {
    if (currentFilePath() !== "") {
      return new Promise((success, failure) => {
        writeTextFile(currentFilePath(), textEditor.value).then(
          () => {
            setTextEdited(false);
            setStartingState(textEditor.value);
            success();
          },
          () => {
            failure();
            message("Error while saving, please try again.")
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

  const newFile = () => {
    if (textEdited() === false) {
      clear();
    } else {
      discardQuery(clear, "To create a new file please save or discard your work.");
    }
  }

  const open = () => {
    clear(); // Clear all
    return openDialog().then((filePath) => {
      if (!filePath) {
        return;
      }
      readTextFile(filePath).then((text) => {
        setStartingState(text);
        textEditor.value = text;
        setCurrentFilePath(filePath);
        setFileName(getFileNameFromPath(filePath));
        calculateStats(); // Update words and characters (It should be 0, however its best to run the function)
      }, () => message("Error while opening file, please try again."));
    }, 
    () => message("Error while opening file, please try again."));
  }

  const openFile = () => {
    if (textEdited() === false) {
      open();
    } else {
      discardQuery(open, "To open a new file please save or discard your work.");
    }
  }

  const closeApplication = () => {
    if (textEdited() === false) {
      appWindow.close();
    } else {
      discardQuery(() => appWindow.close(), "To close please save or discard your work.");
    }
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

  onMount(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && aboutOpen()) {
        setAboutOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  });

  createEffect(() => {
    if (fontSizeEditing() && fontSizeInputRef) {
      fontSizeInputRef.focus();
      fontSizeInputRef.select();
    }
  });

  return (
    <div class="flex flex-col flex-grow h-full border border-gray-200 dark:border-gray-700" onClick={closeMenu}>
      <div className="flex flex-row items-center h-10 px-2 border-b border-gray-200 dark:border-gray-700 bg-gray-100/70 dark:bg-gray-800/70" onClick={(event) => event.stopPropagation()}>
        <div ref={menuBar} className="flex flex-row items-center whitespace-nowrap space-x-1" onMouseLeave={handleMenuLeave}>
          <div className="relative">
            <button className={menuButton} onClick={() => toggleMenu("file")} onMouseEnter={() => switchMenuOnHover("file")}>File</button>
            {openMenu() === "file" ?
              <div className={menuPanel}>
                <button className={menuItem} onClick={() => { openFile(); closeMenu(); }}>Open</button>
                <button className={menuItem} onClick={() => { newFile(); closeMenu(); }}>New</button>
                <button className={menuItem} onClick={() => { saveFile(); closeMenu(); }}>Save</button>
                <button className={menuItem} onClick={() => { saveFileAs(); closeMenu(); }}>Save As</button>
              </div>
            : null}
          </div>

          <div className="relative">
            <button className={menuButton} onClick={() => toggleMenu("font")} onMouseEnter={() => switchMenuOnHover("font")}>Font</button>
            {openMenu() === "font" ?
              <div className={menuPanel}>
                <button className={menuItem} onClick={() => { setTextFontClass("font-sans"); closeMenu(); }}>Sans</button>
                <button className={menuItem} onClick={() => { setTextFontClass("font-serif"); closeMenu(); }}>Serif</button>
                <button className={menuItem} onClick={() => { setTextFontClass("font-mono"); closeMenu(); }}>Mono</button>
                <div className={menuRowSpread}>
                  <button className={toggleButton(fontBold())} onClick={() => setFontBold(!fontBold())} aria-label="Toggle bold">B</button>
                  <button className={toggleButton(fontItalic())} onClick={() => setFontItalic(!fontItalic())} aria-label="Toggle italic">I</button>
                  <button className={toggleButton(fontUnderline())} onClick={() => setFontUnderline(!fontUnderline())} aria-label="Toggle underline">U</button>
                </div>
                <div className={menuRowTight}>
                  <button className={menuArrow} onClick={() => adjustFontSize(-1)} aria-label="Decrease font size">
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                  </button>
                  {fontSizeEditing() ?
                    <input
                      className="min-w-[44px] max-w-[56px] rounded border border-gray-200 bg-white px-1 text-center text-sm text-gray-900 outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
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
                      className="min-w-[44px] text-center text-sm text-gray-700 hover:text-gray-900 dark:text-gray-200 dark:hover:text-white"
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
                <button className={menuItem} onClick={() => { setTextWrapEnabled(!textWrapEnabled()); closeMenu(); }}>{textWrapEnabled() ? "Disable" : "Enable"} Text Wrap</button>
                <button className={menuItem} onClick={() => { document.querySelector("html").classList.add("dark"); closeMenu(); }}>Dark Mode</button>
                <button className={menuItem} onClick={() => { document.querySelector("html").classList.remove("dark"); closeMenu(); }}>Light Mode</button>
                <button className={menuItem} onClick={() => { setStatusBarVisible(!statusBarVisible()); closeMenu(); }}>{statusBarVisible() ? "Hide" : "Show"} Status Bar</button>
              </div>
            : null}
          </div>

          <div className="relative">
            <button className={menuButton} onClick={() => toggleMenu("app")} onMouseEnter={() => switchMenuOnHover("app")}>App</button>
            {openMenu() === "app" ?
              <div className={menuPanel}>
                <button className={menuItem} onClick={() => { setAboutOpen(true); closeMenu(); }}>About</button>
              </div>
            : null}
          </div>
        </div>

        <div data-tauri-drag-region className="flex-1 h-full" />

        <div className="flex flex-row whitespace-nowrap ml-auto space-x-0.5">
          <button className={`!p-1 ${colouredMinimalButton("green")}`} onClick={() => appWindow.minimize()}>
            <svg className={`h-4 w-4 ${headerTextColour}`} viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <button className={`!p-1.5 ${colouredMinimalButton("yellow")}`} onClick={() => appWindow.toggleMaximize()}>
            <svg className={`h-3 w-3 ${headerTextColour}`} viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
              <rect x="4" y="4" width="16" height="16" rx="2" />
            </svg>
          </button>
          <button className={`!p-1 ${colouredMinimalButton("red")}`} onClick={closeApplication}>
            <svg className={`h-4 w-4 ${headerTextColour}`} viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex-1 w-[100%] text-black dark:text-white text-sm overflow-auto relative">
        <textarea spellCheck={false} onInput={() => { calculateStats(); setTextEdited(true) }} wrap={textWrapEnabled() ? "on" : "off"} ref={textEditor} class={`p-3 w-full h-full outline-none resize-none bg-transparent cursor-auto ${textFontClass()}`} style={{ "font-size": `${fontSize()}px`, "line-height": "1.4", "font-weight": fontBold() ? "700" : "400", "font-style": fontItalic() ? "italic" : "normal", "text-decoration": fontUnderline() ? "underline" : "none" }}/>
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

      {aboutOpen() ?
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setAboutOpen(false)}>
          <div className="w-[360px] rounded border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-800" onClick={(event) => event.stopPropagation()}>
            <div className="flex flex-row items-start">
              <div className="mr-auto">
                <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">Wisty</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Version {version()}</div>
              </div>
              <button className={`${minimalButton} ${headerTextColour}`} onClick={() => setAboutOpen(false)}>Close</button>
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
