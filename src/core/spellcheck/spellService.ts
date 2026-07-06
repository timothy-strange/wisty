import { invoke } from "@tauri-apps/api/core";

export type DictionaryInfo = {
  code: string;
  label: string;
};

/**
 * Thin wrapper over the hunspell Tauri commands with a per-word result cache so
 * repeated checks of the same word (common as the viewport is re-scanned) don't
 * cross the IPC boundary more than once.
 */
export const createSpellService = () => {
  const correctnessCache = new Map<string, boolean>();

  const listDictionaries = (): Promise<DictionaryInfo[]> =>
    invoke<DictionaryInfo[]>("spell_list_dictionaries");

  const loadDictionary = async (code: string): Promise<boolean> => {
    const loaded = await invoke<boolean>("spell_load_dictionary", { code });
    correctnessCache.clear();
    return loaded;
  };

  /** Returns the subset of `words` that are misspelled. */
  const findMisspelled = async (words: string[]): Promise<Set<string>> => {
    const unresolved = [...new Set(words.filter((word) => !correctnessCache.has(word)))];

    if (unresolved.length > 0) {
      const results = await invoke<boolean[]>("spell_check_words", { words: unresolved });
      unresolved.forEach((word, index) => {
        correctnessCache.set(word, results[index] ?? true);
      });
    }

    const misspelled = new Set<string>();
    for (const word of words) {
      if (correctnessCache.get(word) === false) {
        misspelled.add(word);
      }
    }
    return misspelled;
  };

  const suggest = (word: string): Promise<string[]> =>
    invoke<string[]>("spell_suggest", { word });

  const addWord = async (word: string): Promise<void> => {
    await invoke("spell_add_word", { word });
    correctnessCache.set(word, true);
  };

  const ignoreWord = async (word: string): Promise<void> => {
    await invoke("spell_ignore_word", { word });
    correctnessCache.set(word, true);
  };

  const listAddedWords = (): Promise<string[]> =>
    invoke<string[]>("spell_list_added_words");

  const removeWord = async (word: string): Promise<void> => {
    await invoke("spell_remove_word", { word });
    correctnessCache.clear();
  };

  const clearCache = () => correctnessCache.clear();

  return {
    listDictionaries,
    loadDictionary,
    findMisspelled,
    suggest,
    addWord,
    ignoreWord,
    listAddedWords,
    removeWord,
    clearCache
  };
};

export type SpellService = ReturnType<typeof createSpellService>;
