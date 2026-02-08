import { createEffect, createSignal, onCleanup, onMount } from "solid-js";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getVersion } from "@tauri-apps/api/app";
import { platform } from "@tauri-apps/plugin-os";
import { undo, redo } from "@codemirror/commands";
import { keymap } from "@codemirror/view";
import AboutDialog from "./features/dialogs/AboutDialog";
import ConfirmDiscardDialog from "./features/dialogs/ConfirmDiscardDialog";
import useEditor from "./features/editor/useEditor";
import useFileActions from "./features/file/useFileActions";
import MenuBar from "./features/menus/MenuBar";
import useSettingsStore from "./features/settings/useSettingsStore";
import StatusBar from "./features/ui/StatusBar";
import { ddebug, derror, dinfo, dtrace, dwarn, initDebugLog } from "./lib/debugLog";
import { getTextStats } from "./lib/textStats";

const appWindow = getCurrentWindow();

export default function Wisty() {
  const [platformName, setPlatformName] = createSignal("");
  const [version, setVersion] = createSignal("");
  const [startingState, setStartingState] = createSignal("");
  const [textEdited, setTextEdited] = createSignal(false);
  const [currentFilePath, setCurrentFilePath] = createSignal("");
  const [textWrapEnabled, setTextWrapEnabled] = createSignal(true);
  const [textFontClass, setTextFontClass] = createSignal("font-sans");
  const [fontSize, setFontSize] = createSignal(14);
  const [fontSizeEditing, setFontSizeEditing] = createSignal(false);
  const [fontSizeInput, setFontSizeInput] = createSignal("14");
  const [themeMode, setThemeMode] = createSignal("light");
  const [highlightSelectionMatchesEnabled, setHighlightSelectionMatchesEnabled] = createSignal(true);
  const [highlightCurrentLineEnabled, setHighlightCurrentLineEnabled] = createSignal(false);
  const [statusBarVisible, setStatusBarVisible] = createSignal(true);
  const [statusBarStatsVisible, setStatusBarStatsVisible] = createSignal(true);
  const [statusBarFontSize, setStatusBarFontSize] = createSignal(12);
  const [statusBarFontSizeEditing, setStatusBarFontSizeEditing] = createSignal(false);
  const [statusBarFontSizeInput, setStatusBarFontSizeInput] = createSignal("12");
  const [findReplaceFontSize, setFindReplaceFontSize] = createSignal(14);
  const [findReplaceFontSizeEditing, setFindReplaceFontSizeEditing] = createSignal(false);
  const [findReplaceFontSizeInput, setFindReplaceFontSizeInput] = createSignal("14");
  const [openMenu, setOpenMenu] = createSignal("");
  const [menuAltActive, setMenuAltActive] = createSignal(false);
  const [aboutOpen, setAboutOpen] = createSignal(false);
  const [fileName, setFileName] = createSignal("Untitled");
  const [statsText, setStatsText] = createSignal("0 Words, 0 Characters");
  const [activeCloseRequestId, setActiveCloseRequestId] = createSignal(0);

  let menuBar;
  let fontSizeInputRef;
  let statusBarFontSizeInputRef;
  let findReplaceFontSizeInputRef;
  let unlistenClose;
  let allowImmediateClose = false;
  let closeRequestSeq = 0;
  let editorApi = {
    focusEditor: () => {},
    getEditorText: () => "",
    setEditorText: () => {},
    openFindPanel: () => false,
    openReplacePanel: () => false,
    cutSelection: async () => false,
    copySelection: async () => false,
    pasteSelection: async () => false,
    undoEdit: () => false,
    redoEdit: () => false
  };

  const updateEditedState = () => {
    const text = editorApi.getEditorText();
    setTextEdited(text !== startingState());
    dtrace("editor", "updateEditedState", { edited: text !== startingState(), textLength: text.length });
  };

  const updateStats = () => {
    const text = editorApi.getEditorText();
    const { words, characters } = getTextStats(text);
    setStatsText(`${words} Words, ${characters} Characters`);
    dtrace("stats", "updateStats", { words, characters });
  };

  const updateStatsIfVisible = () => {
    if (!statusBarVisible() || !statusBarStatsVisible()) {
      return;
    }
    updateStats();
  };

  const applyThemeMode = (mode) => {
    const root = document.querySelector("html");
    if (!root) {
      dwarn("theme", "applyThemeMode aborted: missing html root", { mode });
      return;
    }
    if (mode === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    setThemeMode(mode);
    dinfo("theme", "theme mode applied", { mode });
  };

  const closeMenu = () => {
    setOpenMenu("");
    setFontSizeEditing(false);
    setStatusBarFontSizeEditing(false);
    setFindReplaceFontSizeEditing(false);
    dtrace("menu", "closeMenu");
  };

  const toggleMenu = (menuName) => {
    const previous = openMenu();
    const next = previous === menuName ? "" : menuName;
    setOpenMenu(next);
    if (next === "") {
      setFontSizeEditing(false);
      setStatusBarFontSizeEditing(false);
      setFindReplaceFontSizeEditing(false);
      editorApi.focusEditor();
    }
    ddebug("menu", "toggleMenu", { menuName, previous, next });
  };

  const switchMenuOnHover = (menuName) => {
    if (openMenu() !== "" && openMenu() !== menuName) {
      setOpenMenu(menuName);
      dtrace("menu", "switchMenuOnHover", { menuName });
    }
  };

  const handleMenuLeave = (event) => {
    if (fontSizeEditing()) {
      return;
    }
    if (menuBar && event.relatedTarget && menuBar.contains(event.relatedTarget)) {
      return;
    }
    if (openMenu() === "") {
      return;
    }
    closeMenu();
    editorApi.focusEditor();
  };

  const adjustFontSize = (delta) => {
    const nextSize = Math.min(48, Math.max(8, fontSize() + delta));
    setFontSize(nextSize);
    setFontSizeInput(String(nextSize));
    ddebug("font", "adjustFontSize", { delta, nextSize });
  };

  const commitFontSizeInput = () => {
    const parsed = Number.parseInt(fontSizeInput(), 10);
    const safeSize = Number.isNaN(parsed) ? fontSize() : parsed;
    const clamped = Math.min(48, Math.max(8, safeSize));
    setFontSize(clamped);
    setFontSizeInput(String(clamped));
    setFontSizeEditing(false);
    ddebug("font", "commitFontSizeInput", { raw: fontSizeInput(), clamped });
  };

  const adjustStatusBarFontSize = (delta) => {
    const nextSize = Math.min(18, Math.max(8, statusBarFontSize() + delta));
    setStatusBarFontSize(nextSize);
    setStatusBarFontSizeInput(String(nextSize));
    ddebug("font", "adjustStatusBarFontSize", { delta, nextSize });
  };

  const commitStatusBarFontSizeInput = () => {
    const parsed = Number.parseInt(statusBarFontSizeInput(), 10);
    const safeSize = Number.isNaN(parsed) ? statusBarFontSize() : parsed;
    const clamped = Math.min(18, Math.max(8, safeSize));
    setStatusBarFontSize(clamped);
    setStatusBarFontSizeInput(String(clamped));
    setStatusBarFontSizeEditing(false);
    ddebug("font", "commitStatusBarFontSizeInput", { raw: statusBarFontSizeInput(), clamped });
  };

  const adjustFindReplaceFontSize = (delta) => {
    const nextSize = Math.min(18, Math.max(8, findReplaceFontSize() + delta));
    setFindReplaceFontSize(nextSize);
    setFindReplaceFontSizeInput(String(nextSize));
    ddebug("font", "adjustFindReplaceFontSize", { delta, nextSize });
  };

  const commitFindReplaceFontSizeInput = () => {
    const parsed = Number.parseInt(findReplaceFontSizeInput(), 10);
    const safeSize = Number.isNaN(parsed) ? findReplaceFontSize() : parsed;
    const clamped = Math.min(18, Math.max(8, safeSize));
    setFindReplaceFontSize(clamped);
    setFindReplaceFontSizeInput(String(clamped));
    setFindReplaceFontSizeEditing(false);
    ddebug("font", "commitFindReplaceFontSizeInput", { raw: findReplaceFontSizeInput(), clamped });
  };

  const cycleFontStyle = () => {
    const current = textFontClass();
    if (current === "font-sans") {
      setTextFontClass("font-serif");
      ddebug("font", "cycleFontStyle", { from: current, to: "font-serif" });
      return;
    }
    if (current === "font-serif") {
      setTextFontClass("font-mono");
      ddebug("font", "cycleFontStyle", { from: current, to: "font-mono" });
      return;
    }
    setTextFontClass("font-sans");
    ddebug("font", "cycleFontStyle", { from: current, to: "font-sans" });
  };

  const closeApplication = (source = "unknown") => {
    dinfo("close", "closeApplication requested", { source, closeReqId: activeCloseRequestId() });
    void appWindow.close().then(() => {
      dinfo("close", "closeApplication call resolved", { source, closeReqId: activeCloseRequestId() });
    }, (err) => {
      derror("close", "closeApplication call failed", { source, closeReqId: activeCloseRequestId(), error: String(err) });
    });
  };

  const closeAfterDiscardConfirmation = () => {
    allowImmediateClose = true;
    const closeReqId = activeCloseRequestId();
    dinfo("close", "closeAfterDiscardConfirmation requested", { closeReqId });
    void appWindow.close().then(() => {
      dinfo("close", "closeAfterDiscardConfirmation call resolved", { closeReqId });
    }, (err) => {
      allowImmediateClose = false;
      derror("close", "closeAfterDiscardConfirmation call failed", { closeReqId, error: String(err) });
    });
  };

  const probeConfirmDialogDom = (phase, closeReqId) => {
    const selector = '[data-test="confirm-discard-dialog"]';
    const runProbe = (kind) => {
      const node = document.querySelector(selector);
      ddebug("close", "confirm dialog dom probe", {
        closeReqId,
        phase,
        probe: kind,
        present: Boolean(node),
        tagName: node ? node.tagName : null
      });
    };
    queueMicrotask(() => runProbe("microtask"));
    requestAnimationFrame(() => runProbe("animationFrame"));
  };

  const closeAbout = () => {
    setAboutOpen(false);
    editorApi.focusEditor();
    dtrace("about", "closeAbout");
  };

  const findInDocument = () => {
    const opened = editorApi.openFindPanel();
    ddebug("shortcut", "find panel requested", { opened });
    return opened;
  };

  const replaceInDocument = () => {
    const opened = editorApi.openReplacePanel();
    ddebug("shortcut", "replace panel requested", { opened });
    return opened;
  };

  const undoInDocument = () => {
    const handled = editorApi.undoEdit();
    ddebug("shortcut", "undo requested from menu", { handled });
    editorApi.focusEditor();
    return handled;
  };

  const redoInDocument = () => {
    const handled = editorApi.redoEdit();
    ddebug("shortcut", "redo requested from menu", { handled });
    editorApi.focusEditor();
    return handled;
  };

  const cutInDocument = () => {
    void editorApi.cutSelection().then((handled) => {
      ddebug("shortcut", "cut requested from menu", { handled });
      editorApi.focusEditor();
    }, () => {
      ddebug("shortcut", "cut requested from menu", { handled: false });
      editorApi.focusEditor();
    });
    return true;
  };

  const copyInDocument = () => {
    void editorApi.copySelection().then((handled) => {
      ddebug("shortcut", "copy requested from menu", { handled });
      editorApi.focusEditor();
    }, () => {
      ddebug("shortcut", "copy requested from menu", { handled: false });
      editorApi.focusEditor();
    });
    return true;
  };

  const pasteInDocument = () => {
    void editorApi.pasteSelection().then((handled) => {
      ddebug("shortcut", "paste requested from menu", { handled });
      editorApi.focusEditor();
    }, () => {
      ddebug("shortcut", "paste requested from menu", { handled: false });
      editorApi.focusEditor();
    });
    return true;
  };

  const { lastDirectory, recordLastDirectory } = useSettingsStore({
    fontSize,
    setFontSize,
    setFontSizeInput,
    textFontClass,
    setTextFontClass,
    statusBarVisible,
    setStatusBarVisible,
    statusBarStatsVisible,
    setStatusBarStatsVisible,
    statusBarFontSize,
    setStatusBarFontSize,
    setStatusBarFontSizeInput,
    findReplaceFontSize,
    setFindReplaceFontSize,
    setFindReplaceFontSizeInput,
    highlightSelectionMatchesEnabled,
    setHighlightSelectionMatchesEnabled,
    highlightCurrentLineEnabled,
    setHighlightCurrentLineEnabled,
    textWrapEnabled,
    setTextWrapEnabled,
    themeMode,
    applyThemeMode
  });

  const fileActions = useFileActions({
    textEdited,
    setTextEdited,
    currentFilePath,
    setCurrentFilePath,
    startingState,
    setStartingState,
    setFileName,
    lastDirectory,
    recordLastDirectory,
    updateEditedState,
    updateStatsIfVisible,
    currentCloseRequestId: activeCloseRequestId,
    getEditorText: () => editorApi.getEditorText(),
    setEditorText: (text) => editorApi.setEditorText(text),
    focusEditor: () => editorApi.focusEditor()
  });

  createEffect(() => {
    const confirmOpen = fileActions.confirmOpen();
    const closeReqId = activeCloseRequestId();
    ddebug("close", "confirmOpen state changed", { closeReqId, confirmOpen });
    if (confirmOpen && openMenu() !== "") {
      ddebug("close", "confirmOpen forcing menu close", { closeReqId, openMenu: openMenu() });
      closeMenu();
      setMenuAltActive(false);
    }
    if (confirmOpen) {
      probeConfirmDialogDom("confirm-open-true", closeReqId);
    } else {
      probeConfirmDialogDom("confirm-open-false", closeReqId);
    }
  });

  createEffect(() => {
    dtrace("close", "close flow state snapshot", {
      closeReqId: activeCloseRequestId(),
      textEdited: textEdited(),
      confirmOpen: fileActions.confirmOpen(),
      aboutOpen: aboutOpen(),
      allowImmediateClose
    });
  });

  createEffect(() => {
    ddebug("about", "aboutOpen state changed", { aboutOpen: aboutOpen(), closeReqId: activeCloseRequestId() });
  });

  createEffect(() => {
    ddebug("theme", "themeMode state changed", { themeMode: themeMode(), closeReqId: activeCloseRequestId() });
  });

  createEffect(() => {
    ddebug("settings", "highlightSelectionMatchesEnabled state changed", {
      value: highlightSelectionMatchesEnabled(),
      closeReqId: activeCloseRequestId()
    });
  });

  createEffect(() => {
    ddebug("settings", "highlightCurrentLineEnabled state changed", {
      value: highlightCurrentLineEnabled(),
      closeReqId: activeCloseRequestId()
    });
  });

  const runIfReady = (action) => (view) => {
    if (fileActions.confirmOpen() || aboutOpen()) {
      dtrace("shortcut", "runIfReady blocked by modal", { confirmOpen: fileActions.confirmOpen(), aboutOpen: aboutOpen() });
      return true;
    }
    const result = action(view);
    return typeof result === "boolean" ? result : true;
  };

  const buildKeymap = () => keymap.of([
    { key: "Mod-z", run: runIfReady((view) => { ddebug("shortcut", "Mod-z"); return undo(view); }), preventDefault: true },
    { key: "Mod-Shift-z", run: runIfReady((view) => { ddebug("shortcut", "Mod-Shift-z"); return redo(view); }), preventDefault: true },
    { key: "Mod-y", run: runIfReady((view) => { ddebug("shortcut", "Mod-y"); return redo(view); }), preventDefault: true },
    { key: "Mod-=", run: runIfReady(() => { ddebug("shortcut", "Mod-="); return adjustFontSize(1); }), preventDefault: true },
    { key: "Mod-Shift-=", run: runIfReady(() => { ddebug("shortcut", "Mod-Shift-="); return adjustFontSize(1); }), preventDefault: true },
    { key: "Mod--", run: runIfReady(() => { ddebug("shortcut", "Mod--"); return adjustFontSize(-1); }), preventDefault: true },
    { key: "Mod-n", run: runIfReady(() => { ddebug("shortcut", "Mod-n"); return fileActions.newFile(); }), preventDefault: true },
    { key: "Mod-o", run: runIfReady(() => { ddebug("shortcut", "Mod-o"); return fileActions.openFile(); }), preventDefault: true },
    { key: "Mod-f", run: runIfReady(() => { ddebug("shortcut", "Mod-f"); return findInDocument(); }), preventDefault: true },
    { key: "Mod-h", run: runIfReady(() => { ddebug("shortcut", "Mod-h"); return replaceInDocument(); }), preventDefault: true },
    { key: "Mod-s", run: runIfReady(() => { ddebug("shortcut", "Mod-s"); void fileActions.saveFile(); }), preventDefault: true },
    { key: "Mod-Shift-s", run: runIfReady(() => { ddebug("shortcut", "Mod-Shift-s"); void fileActions.saveFileAs(); }), preventDefault: true },
    { key: "Mod-q", run: runIfReady(() => { ddebug("shortcut", "Mod-q"); return closeApplication("shortcut-mod-q"); }), preventDefault: true },
    { key: "Mod-b", run: runIfReady(() => { ddebug("shortcut", "Mod-b"); return cycleFontStyle(); }), preventDefault: true },
    { key: "Mod-m", run: runIfReady(() => { ddebug("shortcut", "Mod-m"); return applyThemeMode(themeMode() === "dark" ? "light" : "dark"); }), preventDefault: true },
    { key: "Mod-j", run: runIfReady(() => { ddebug("shortcut", "Mod-j"); return setTextWrapEnabled(!textWrapEnabled()); }), preventDefault: true },
    { key: "Mod-u", run: runIfReady(() => { ddebug("shortcut", "Mod-u"); return setStatusBarVisible(!statusBarVisible()); }), preventDefault: true },
    { key: "F1", run: runIfReady(() => { ddebug("shortcut", "F1"); return setAboutOpen(true); }), preventDefault: true }
  ]);

  editorApi = useEditor({
    textWrapEnabled,
    textFontClass,
    fontSize,
    themeMode,
    findReplaceFontSize,
    confirmOpen: fileActions.confirmOpen,
    aboutOpen,
    menuOpen: openMenu,
    highlightSelectionMatchesEnabled,
    highlightCurrentLineEnabled,
    buildKeymap,
    onDocChanged: () => {
      updateEditedState();
      updateStatsIfVisible();
    }
  });

  onMount(() => {
    initDebugLog();
    dinfo("startup", "onMount begin");
    document.title = "wisty";
    const resolvedPlatform = platform();
    setPlatformName(resolvedPlatform);
    dinfo("startup", "platform resolved", { platform: resolvedPlatform });
    getVersion().then((resolvedVersion) => {
      setVersion(resolvedVersion);
      dinfo("startup", "version resolved", { version: resolvedVersion });
    }, (err) => {
      derror("startup", "version resolution failed", { error: String(err) });
    });

    void appWindow.title().then((nativeTitle) => {
      dinfo("window", "native window initial title", { nativeTitle });
    }, (err) => {
      derror("window", "failed to read native initial title", { error: String(err) });
    });

    const handleKeyDown = (event) => {
      const isModM = (event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "m";
      const isF1 = event.key === "F1";
      if (isModM || isF1) {
        const targetTag = event.target && event.target.tagName ? event.target.tagName : null;
        ddebug("keyboard", "global key diagnostic", {
          key: event.key,
          code: event.code,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          altKey: event.altKey,
          shiftKey: event.shiftKey,
          repeat: event.repeat,
          defaultPrevented: event.defaultPrevented,
          targetTag,
          confirmOpen: fileActions.confirmOpen(),
          aboutOpen: aboutOpen()
        });
      }

      if (isF1) {
        event.preventDefault();
        if (fileActions.confirmOpen()) {
          ddebug("keyboard", "global F1 ignored due to confirm dialog");
          return;
        }
        ddebug("shortcut", "F1 global fallback fired");
        setAboutOpen(true);
        return;
      }

      if (isModM) {
        event.preventDefault();
        if (fileActions.confirmOpen() || aboutOpen()) {
          ddebug("keyboard", "global Mod-m ignored due to modal", {
            confirmOpen: fileActions.confirmOpen(),
            aboutOpen: aboutOpen()
          });
          return;
        }
        ddebug("shortcut", "Mod-m global fallback fired", { from: themeMode(), to: themeMode() === "dark" ? "light" : "dark" });
        applyThemeMode(themeMode() === "dark" ? "light" : "dark");
        return;
      }

      if (event.ctrlKey || event.metaKey || event.altKey || event.key === "Escape") {
        dtrace("keyboard", "keydown", {
          key: event.key,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          altKey: event.altKey,
          shiftKey: event.shiftKey
        });
      }
      if (event.key === "Alt") {
        setMenuAltActive(true);
        return;
      }
      if (fileActions.confirmOpen()) {
        if (event.key === "Escape") {
          event.preventDefault();
          ddebug("keyboard", "escape dismisses confirm dialog");
          fileActions.resolveConfirm(false);
        }
        return;
      }
      if (aboutOpen()) {
        if (event.key === "Escape") {
          event.preventDefault();
          ddebug("keyboard", "escape dismisses about dialog");
          closeAbout();
        }
        return;
      }
      if (event.key === "Escape") {
        if (openMenu() !== "") {
          event.preventDefault();
          ddebug("keyboard", "escape closes menu", { menu: openMenu() });
          closeMenu();
          setMenuAltActive(false);
          editorApi.focusEditor();
        }
        return;
      }
      if (event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
        const key = event.key.toLowerCase();
        let menuName = "";
        if (key === "f") {
          menuName = "file";
        } else if (key === "e") {
          menuName = "edit";
        } else if (key === "o") {
          menuName = "font";
        } else if (key === "s") {
          menuName = "settings";
        } else if (key === "a") {
          menuName = "app";
        }
        if (menuName) {
          event.preventDefault();
          ddebug("keyboard", "alt menu toggle", { key, menuName, previous: openMenu() });
          setMenuAltActive(true);
          setOpenMenu(openMenu() === menuName ? "" : menuName);
        }
      }
    };

    const handleKeyUp = (event) => {
      if (event.key === "Alt") {
        setMenuAltActive(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    dinfo("startup", "window keyboard listeners attached");

    const setupCloseListener = async () => {
      dinfo("close", "register onCloseRequested listener start");
      try {
        unlistenClose = await appWindow.onCloseRequested(async (event) => {
          closeRequestSeq += 1;
          const closeReqId = closeRequestSeq;
          setActiveCloseRequestId(closeReqId);
          ddebug("close", "onCloseRequested fired", {
            closeReqId,
            textEdited: textEdited(),
            confirmOpen: fileActions.confirmOpen(),
            aboutOpen: aboutOpen()
          });
          if (allowImmediateClose) {
            allowImmediateClose = false;
            dinfo("close", "onCloseRequested allowing immediate close", { closeReqId });
            return;
          }
          if (!textEdited()) {
            dinfo("close", "onCloseRequested allows close (no unsaved edits)", { closeReqId });
            return;
          }
          event.preventDefault();
          dinfo("close", "onCloseRequested prevented close while awaiting confirmation", { closeReqId });
          probeConfirmDialogDom("after-prevent-default", closeReqId);
          dinfo("close", "onCloseRequested awaiting discard confirmation", { closeReqId });
          const shouldDiscard = await fileActions.confirmDiscard({ source: "os-close", closeReqId });
          dinfo("close", "onCloseRequested confirmation resolved", { closeReqId, shouldDiscard });
          if (shouldDiscard) {
            closeAfterDiscardConfirmation();
          } else {
            dinfo("close", "close prevented by user decision", { closeReqId });
            editorApi.focusEditor();
          }
        });
        dinfo("close", "register onCloseRequested listener success");
      } catch (err) {
        derror("close", "register onCloseRequested listener failed", { error: String(err) });
      }
    };
    void setupCloseListener();

    onCleanup(() => {
      dinfo("shutdown", "onCleanup begin");
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      dinfo("shutdown", "window keyboard listeners removed");
      if (unlistenClose) {
        unlistenClose();
        unlistenClose = null;
        dinfo("shutdown", "onCloseRequested listener removed");
      }
      dinfo("shutdown", "onCleanup complete");
    });
  });

  onMount(() => {
    const handleFocus = () => dtrace("window", "focus event", { closeReqId: activeCloseRequestId() });
    const handleBlur = () => dtrace("window", "blur event", { closeReqId: activeCloseRequestId() });
    const handleVisibility = () => dtrace("window", "visibilitychange", {
      closeReqId: activeCloseRequestId(),
      visibilityState: document.visibilityState
    });

    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("visibilitychange", handleVisibility);

    onCleanup(() => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("visibilitychange", handleVisibility);
    });
  });

  createEffect(() => {
    if (fontSizeEditing() && fontSizeInputRef) {
      fontSizeInputRef.focus();
      fontSizeInputRef.select();
      dtrace("font", "focus font size input");
    }
  });

  createEffect(() => {
    if (statusBarFontSizeEditing() && statusBarFontSizeInputRef) {
      statusBarFontSizeInputRef.focus();
      statusBarFontSizeInputRef.select();
      dtrace("font", "focus status bar font size input");
    }
  });

  createEffect(() => {
    if (findReplaceFontSizeEditing() && findReplaceFontSizeInputRef) {
      findReplaceFontSizeInputRef.focus();
      findReplaceFontSizeInputRef.select();
      dtrace("font", "focus find replace font size input");
    }
  });

  createEffect(() => {
    if (statusBarVisible() && statusBarStatsVisible()) {
      updateStats();
    }
  });

  return (
    <div class="relative flex flex-col flex-grow h-full border border-gray-200 dark:border-gray-700" onClick={closeMenu}>
      <MenuBar
        menuBarRef={(el) => { menuBar = el; }}
        handleMenuLeave={handleMenuLeave}
        toggleMenu={toggleMenu}
        switchMenuOnHover={switchMenuOnHover}
        closeMenu={closeMenu}
        openMenu={openMenu}
        menuAltActive={menuAltActive}
        platformName={platformName}
        openFile={fileActions.openFile}
        findInDocument={findInDocument}
        replaceInDocument={replaceInDocument}
        undoInDocument={undoInDocument}
        redoInDocument={redoInDocument}
        cutInDocument={cutInDocument}
        copyInDocument={copyInDocument}
        pasteInDocument={pasteInDocument}
        newFile={fileActions.newFile}
        saveFile={fileActions.saveFile}
        saveFileAs={fileActions.saveFileAs}
        closeApplication={() => closeApplication("menu-quit")}
        textFontClass={textFontClass}
        setTextFontClass={setTextFontClass}
        adjustFontSize={adjustFontSize}
        fontSizeEditing={fontSizeEditing}
        fontSizeInputRef={(el) => { fontSizeInputRef = el; }}
        fontSizeInput={fontSizeInput}
        setFontSizeInput={setFontSizeInput}
        commitFontSizeInput={commitFontSizeInput}
        setFontSizeEditing={setFontSizeEditing}
        fontSize={fontSize}
        textWrapEnabled={textWrapEnabled}
        setTextWrapEnabled={setTextWrapEnabled}
        applyThemeMode={applyThemeMode}
        themeMode={themeMode}
        highlightSelectionMatchesEnabled={highlightSelectionMatchesEnabled}
        setHighlightSelectionMatchesEnabled={setHighlightSelectionMatchesEnabled}
        highlightCurrentLineEnabled={highlightCurrentLineEnabled}
        setHighlightCurrentLineEnabled={setHighlightCurrentLineEnabled}
        statusBarVisible={statusBarVisible}
        setStatusBarVisible={setStatusBarVisible}
        statusBarStatsVisible={statusBarStatsVisible}
        setStatusBarStatsVisible={setStatusBarStatsVisible}
        statusBarFontSize={statusBarFontSize}
        statusBarFontSizeEditing={statusBarFontSizeEditing}
        setStatusBarFontSizeEditing={setStatusBarFontSizeEditing}
        statusBarFontSizeInput={statusBarFontSizeInput}
        setStatusBarFontSizeInput={setStatusBarFontSizeInput}
        statusBarFontSizeInputRef={(el) => { statusBarFontSizeInputRef = el; }}
        adjustStatusBarFontSize={adjustStatusBarFontSize}
        commitStatusBarFontSizeInput={commitStatusBarFontSizeInput}
        findReplaceFontSize={findReplaceFontSize}
        findReplaceFontSizeEditing={findReplaceFontSizeEditing}
        setFindReplaceFontSizeEditing={setFindReplaceFontSizeEditing}
        findReplaceFontSizeInput={findReplaceFontSizeInput}
        setFindReplaceFontSizeInput={setFindReplaceFontSizeInput}
        findReplaceFontSizeInputRef={(el) => { findReplaceFontSizeInputRef = el; }}
        adjustFindReplaceFontSize={adjustFindReplaceFontSize}
        commitFindReplaceFontSizeInput={commitFindReplaceFontSizeInput}
        setAboutOpen={setAboutOpen}
      />

      <div className="flex-1 min-h-0 w-[100%] text-black dark:text-white text-sm overflow-hidden relative">
        <div ref={(el) => editorApi.setEditorHost(el)} className="h-full w-full" />
      </div>

      {statusBarVisible() ? <StatusBar filePath={currentFilePath() || "Untitled"} statsText={statsText()} showStats={statusBarStatsVisible()} fontSize={statusBarFontSize()} /> : null}
      <ConfirmDiscardDialog
        open={fileActions.confirmOpen()}
        closeReqId={activeCloseRequestId()}
        onCancel={() => fileActions.resolveConfirm(false, { source: "dialog-cancel", closeReqId: activeCloseRequestId() })}
        onDiscard={() => fileActions.resolveConfirm(true, { source: "dialog-discard", closeReqId: activeCloseRequestId() })}
      />
      <AboutDialog open={aboutOpen()} version={version()} platformName={platformName()} onClose={closeAbout} />
    </div>
  );
}
