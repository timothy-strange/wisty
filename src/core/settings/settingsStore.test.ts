import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSettingsStore } from "./settingsStore";
import { DEFAULT_SETTINGS } from "./settingsTypes";

const backing = new Map<string, unknown>();

vi.mock("@tauri-apps/plugin-store", () => ({
  Store: {
    load: vi.fn(async () => ({
      get: vi.fn(async (key: string) => backing.get(key)),
      set: vi.fn(async (key: string, value: unknown) => {
        backing.set(key, value);
      }),
      save: vi.fn(async () => {})
    }))
  }
}));

beforeEach(() => {
  backing.clear();
  window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
});

describe("createSettingsStore load", () => {
  it("falls back to defaults when nothing has been persisted", async () => {
    const store = createSettingsStore();
    await store.load();
    expect(store.state.formatViewMode).toBe(DEFAULT_SETTINGS.formatViewMode);
    expect(store.state.activeLineHighlightEnabled).toBe(DEFAULT_SETTINGS.activeLineHighlightEnabled);
    expect(store.state.fontSize).toBe(DEFAULT_SETTINGS.fontSize);
    expect(store.ready()).toBe(true);
  });

  it("rejects an invalid persisted formatViewMode and falls back to the default", async () => {
    backing.set("formatViewMode", "not-a-real-mode");
    const store = createSettingsStore();
    await store.load();
    expect(store.state.formatViewMode).toBe(DEFAULT_SETTINGS.formatViewMode);
  });

  it("loads a valid persisted formatViewMode", async () => {
    backing.set("formatViewMode", "formatted");
    const store = createSettingsStore();
    await store.load();
    expect(store.state.formatViewMode).toBe("formatted");
  });

  it("rejects a non-boolean persisted activeLineHighlightEnabled", async () => {
    backing.set("activeLineHighlightEnabled", "yes");
    const store = createSettingsStore();
    await store.load();
    expect(store.state.activeLineHighlightEnabled).toBe(DEFAULT_SETTINGS.activeLineHighlightEnabled);
  });

  it("loads a valid persisted activeLineHighlightEnabled", async () => {
    backing.set("activeLineHighlightEnabled", true);
    const store = createSettingsStore();
    await store.load();
    expect(store.state.activeLineHighlightEnabled).toBe(true);
  });

  it("clamps an out-of-range persisted fontSize", async () => {
    backing.set("fontSize", 999);
    const store = createSettingsStore();
    await store.load();
    expect(store.state.fontSize).toBe(40);
  });
});

describe("createSettingsStore actions", () => {
  it("setFormatViewMode updates state and persists", async () => {
    const store = createSettingsStore();
    await store.load();
    await store.actions.setFormatViewMode("formatted");
    expect(store.state.formatViewMode).toBe("formatted");
    expect(backing.get("formatViewMode")).toBe("formatted");
  });

  it("setActiveLineHighlightEnabled updates state and persists", async () => {
    const store = createSettingsStore();
    await store.load();
    await store.actions.setActiveLineHighlightEnabled(true);
    expect(store.state.activeLineHighlightEnabled).toBe(true);
    expect(backing.get("activeLineHighlightEnabled")).toBe(true);
  });

  it("does not persist changes before load() has completed", async () => {
    const store = createSettingsStore();
    await store.actions.setActiveLineHighlightEnabled(true);
    expect(store.state.activeLineHighlightEnabled).toBe(true);
    expect(backing.has("activeLineHighlightEnabled")).toBe(false);
  });
});
