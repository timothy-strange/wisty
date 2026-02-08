import { createStore } from "solid-js/store";

export type DocumentMetaState = {
  filePath: string;
  fileName: string;
  isDirty: boolean;
  currentRevision: number;
  baselineRevision: number;
};

const UNTITLED = "Untitled";

const fileNameFromPath = (filePath: string) => {
  if (!filePath) {
    return UNTITLED;
  }
  const normalized = filePath.replace(/\\/g, "/");
  const segments = normalized.split("/");
  return segments[segments.length - 1] || UNTITLED;
};

export const createDocumentStore = () => {
  const [state, setState] = createStore<DocumentMetaState>({
    filePath: "",
    fileName: UNTITLED,
    isDirty: false,
    currentRevision: 0,
    baselineRevision: 0
  });

  const setRevision = (revision: number) => {
    setState({
      currentRevision: revision,
      isDirty: revision !== state.baselineRevision
    });
  };

  const markCleanAt = (revision: number) => {
    setState({
      currentRevision: revision,
      baselineRevision: revision,
      isDirty: false
    });
  };

  const setFilePath = (filePath: string) => {
    setState({
      filePath,
      fileName: fileNameFromPath(filePath)
    });
  };

  const setUntitled = () => {
    setState({ filePath: "", fileName: UNTITLED });
  };

  return {
    state,
    setRevision,
    markCleanAt,
    setFilePath,
    setUntitled
  };
};
