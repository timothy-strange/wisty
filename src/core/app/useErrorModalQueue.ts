import { createMemo, createSignal } from "solid-js";

export type ErrorModalEntry = {
  id: number;
  title: string;
  message: string;
  code?: string;
  details?: Record<string, unknown>;
};

export const useErrorModalQueue = () => {
  const [entries, setEntries] = createSignal<ErrorModalEntry[]>([]);
  let nextId = 1;

  const enqueue = (entry: Omit<ErrorModalEntry, "id">) => {
    const withId: ErrorModalEntry = {
      ...entry,
      id: nextId
    };
    nextId += 1;
    setEntries((current) => [...current, withId]);
  };

  const dismissCurrent = () => {
    setEntries((current) => current.slice(1));
  };

  const clear = () => {
    setEntries([]);
  };

  const current = createMemo(() => entries()[0] ?? null);
  const open = createMemo(() => current() !== null);

  return {
    entries,
    current,
    open,
    enqueue,
    dismissCurrent,
    clear
  };
};
