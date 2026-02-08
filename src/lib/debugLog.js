const COMPILE_TIME_DEBUG = __WISTY_DEBUG__;

export const DEBUG_LOG_CONFIG = {
  enabled: true,
  minLevel: "trace",
  sections: {
    close: false,
    "close-dialog": false,
    keyboard: true,
    shortcut: true,
    theme: true,
    about: true,
    window: true,
    startup: true,
    shutdown: true,
    editor: true,
    file: false,
    settings: true,
    stats: false,
    menu: true,
    font: false,
    log: true
  }
};

const LEVEL_PRIORITY = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50
};

let initDone = false;
let pluginLoaded = false;
let pluginLoadPromise = null;

const noopLogger = async () => {};

const loggerFns = {
  trace: noopLogger,
  debug: noopLogger,
  info: noopLogger,
  warn: noopLogger,
  error: noopLogger
};

const ensurePluginLogLoaded = async () => {
  if (!COMPILE_TIME_DEBUG) {
    return false;
  }
  if (pluginLoaded) {
    return true;
  }
  if (!pluginLoadPromise) {
    pluginLoadPromise = import("@tauri-apps/plugin-log")
      .then((logPlugin) => {
        loggerFns.trace = logPlugin.trace;
        loggerFns.debug = logPlugin.debug;
        loggerFns.info = logPlugin.info;
        loggerFns.warn = logPlugin.warn;
        loggerFns.error = logPlugin.error;
        pluginLoaded = true;
        return true;
      })
      .catch(() => false);
  }
  return pluginLoadPromise;
};

const serialize = (value) => {
  if (value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return "[unserializable]";
  }
};

const formatMessage = (area, event, data) => {
  const prefix = `[Wisty][${area}] ${event}`;
  const suffix = serialize(data);
  return suffix ? `${prefix} ${suffix}` : prefix;
};

const sectionEnabled = (area) => {
  const sections = DEBUG_LOG_CONFIG.sections || {};
  if (Object.prototype.hasOwnProperty.call(sections, area)) {
    return Boolean(sections[area]);
  }
  return Boolean(sections["*"]);
};

const emit = (levelName, area, event, data) => {
  if (!COMPILE_TIME_DEBUG) {
    return;
  }
  if (!DEBUG_LOG_CONFIG.enabled) {
    return;
  }
  const configuredLevel = DEBUG_LOG_CONFIG.minLevel || "debug";
  if ((LEVEL_PRIORITY[levelName] || 0) < (LEVEL_PRIORITY[configuredLevel] || 0)) {
    return;
  }
  if (!sectionEnabled(area)) {
    return;
  }

  void ensurePluginLogLoaded().then((ready) => {
    if (!ready) {
      return;
    }
    void loggerFns[levelName](formatMessage(area, event, data)).catch(() => {
      // ignore logger transport failures
    });
  });
};

export const initDebugLog = () => {
  if (!COMPILE_TIME_DEBUG || !DEBUG_LOG_CONFIG.enabled || initDone) {
    return;
  }
  initDone = true;
  emit("info", "log", "debug logging enabled", {
    enabled: DEBUG_LOG_CONFIG.enabled,
    minLevel: DEBUG_LOG_CONFIG.minLevel,
    sections: DEBUG_LOG_CONFIG.sections
  });
};

export const dtrace = (area, event, data) => emit("trace", area, event, data);
export const ddebug = (area, event, data) => emit("debug", area, event, data);
export const dinfo = (area, event, data) => emit("info", area, event, data);
export const dwarn = (area, event, data) => emit("warn", area, event, data);
export const derror = (area, event, data) => emit("error", area, event, data);
