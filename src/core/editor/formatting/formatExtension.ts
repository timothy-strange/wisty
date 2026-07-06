import { Extension, Range, StateEffect, StateField, Transaction } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import type { FormatViewMode } from "../../settings/settingsTypes";

/** Switches the live view mode. Dispatched by the menu/keyboard toggle. */
export const setFormatModeEffect = StateEffect.define<FormatViewMode>();

/** Matches an ATX heading prefix ("## ") at the start of a line. */
const HEADING_PATTERN = /^(#{1,6})[ \t]+/;

/**
 * Inline emphasis, delimiters kept out of the captured content. Bold is tried
 * before italic so `**x**` is not read as two stray `*`. Content is one-or-more
 * non-delimiter characters, so empty runs like `****` never match — which is
 * what keeps deleting the last letter of a word from leaving orphaned markers.
 * Underscore italic requires word boundaries so `snake_case` is left alone.
 */
const INLINE_PATTERN =
  /\*\*([^*\n]+?)\*\*|\*([^*\n]+?)\*|(?<![\p{L}\p{N}_])_([^_\n]+?)_(?![\p{L}\p{N}_])/gu;

const boldMark = Decoration.mark({ class: "cm-fmt-bold" });
const italicMark = Decoration.mark({ class: "cm-fmt-italic" });
const hiddenMarker = Decoration.replace({});
const headingLine = (level: number) => Decoration.line({ class: `cm-fmt-h${level}` });

/** True when the transaction removes any document content (delete, cut, replace). */
const removesContent = (tr: Transaction): boolean => {
  let removed = false;
  tr.changes.iterChanges((fromA, toA) => {
    if (toA > fromA) {
      removed = true;
    }
  });
  return removed;
};

const createModeField = (getInitialMode: () => FormatViewMode) =>
  StateField.define<FormatViewMode>({
    create: () => getInitialMode(),
    update(mode, tr) {
      for (const effect of tr.effects) {
        if (effect.is(setFormatModeEffect)) {
          return effect.value;
        }
      }
      // Any edit that removes content reveals the raw markup: drop to plain view
      // so the user is never deleting against invisible delimiter characters.
      if (mode === "formatted" && tr.docChanged && removesContent(tr)) {
        return "plain";
      }
      return mode;
    }
  });

const collectInline = (lineText: string, start: number, lineFrom: number, ranges: Range<Decoration>[]) => {
  const scanFrom = lineFrom + start;
  const slice = lineText.slice(start);
  INLINE_PATTERN.lastIndex = 0;
  for (let match = INLINE_PATTERN.exec(slice); match; match = INLINE_PATTERN.exec(slice)) {
    const [bold, italicStar, italicUnderscore] = [match[1], match[2], match[3]];
    const content = bold ?? italicStar ?? italicUnderscore;
    const delimiter = bold !== undefined ? 2 : 1;
    const mark = bold !== undefined ? boldMark : italicMark;

    const openFrom = scanFrom + match.index;
    const contentFrom = openFrom + delimiter;
    const contentTo = contentFrom + content.length;
    const closeTo = contentTo + delimiter;

    ranges.push(hiddenMarker.range(openFrom, contentFrom));
    ranges.push(mark.range(contentFrom, contentTo));
    ranges.push(hiddenMarker.range(contentTo, closeTo));
  }
};

/** Builds the styling/marker-hiding decorations for the visible lines. */
const buildDecorations = (view: EditorView): DecorationSet => {
  const ranges: Range<Decoration>[] = [];
  const { doc } = view.state;

  for (const { from, to } of view.visibleRanges) {
    const firstLine = doc.lineAt(from).number;
    const lastLine = doc.lineAt(to).number;
    for (let lineNumber = firstLine; lineNumber <= lastLine; lineNumber++) {
      const line = doc.line(lineNumber);
      let inlineStart = 0;

      const heading = HEADING_PATTERN.exec(line.text);
      if (heading) {
        ranges.push(headingLine(heading[1].length).range(line.from));
        ranges.push(hiddenMarker.range(line.from, line.from + heading[0].length));
        inlineStart = heading[0].length;
      }

      collectInline(line.text, inlineStart, line.from, ranges);
    }
  }

  return Decoration.set(ranges, true);
};

const createDecorationPlugin = (modeField: StateField<FormatViewMode>) =>
  ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = this.compute(view);
      }

      update(update: ViewUpdate) {
        const modeChanged = update.startState.field(modeField) !== update.state.field(modeField);
        if (update.docChanged || update.viewportChanged || modeChanged) {
          this.decorations = this.compute(update.view);
        }
      }

      private compute(view: EditorView): DecorationSet {
        return view.state.field(modeField) === "formatted" ? buildDecorations(view) : Decoration.none;
      }
    },
    { decorations: (plugin) => plugin.decorations }
  );

const formatTheme = EditorView.baseTheme({
  ".cm-fmt-bold": { fontWeight: "700" },
  ".cm-fmt-italic": { fontStyle: "italic" },
  ".cm-fmt-h1": { fontSize: "1.9em", fontWeight: "700", lineHeight: "1.3" },
  ".cm-fmt-h2": { fontSize: "1.6em", fontWeight: "700", lineHeight: "1.3" },
  ".cm-fmt-h3": { fontSize: "1.35em", fontWeight: "700", lineHeight: "1.35" },
  ".cm-fmt-h4": { fontSize: "1.2em", fontWeight: "700" },
  ".cm-fmt-h5": { fontSize: "1.1em", fontWeight: "700" },
  ".cm-fmt-h6": { fontSize: "1em", fontWeight: "700", opacity: "0.85" }
});

export type FormattingExtension = {
  modeField: StateField<FormatViewMode>;
  extension: Extension;
};

/**
 * Builds the formatting feature: a live view-mode field (with the reveal-on-delete
 * rule), the decoration plugin that hides markers and styles content in formatted
 * mode, and the theme. `getInitialMode` is read whenever a fresh editor state is
 * created so new/reset documents open in the persisted mode.
 */
export const createFormatting = (getInitialMode: () => FormatViewMode): FormattingExtension => {
  const modeField = createModeField(getInitialMode);
  return {
    modeField,
    extension: [modeField, createDecorationPlugin(modeField), formatTheme]
  };
};
