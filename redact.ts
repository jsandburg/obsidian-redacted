import type { RedactPluginSettings } from "./settings";

/** Number of block characters used in fixed-length mode. */
export const FIXED_LENGTH = 5;

/**
 * Splits text into user-perceived characters (graphemes), so an emoji built
 * from several code points — 👨‍👩‍👧, 👍🏽, ❤️, a flag — or a letter with a
 * combining accent counts as one character.
 */
const graphemes = new Intl.Segmenter();
const splitGraphemes = (text: string): string[] =>
  Array.from(graphemes.segment(text), ({ segment }) => segment);

/**
 * Why `char` can't be the redaction character, or undefined if it can.
 * Validates the "Custom character" setting.
 *
 * "Single character" means one user-perceived character (grapheme), so an
 * emoji like ❤️ — two code points — is accepted.
 */
export function blockCharError(char: string): string | undefined {
  if (splitGraphemes(char).length !== 1) {
    return "Enter a single character.";
  }
  // Blank or invisible: whitespace, control and format characters (e.g.
  // zero-width space), or a lone combining mark.
  if (/^[\s\p{Cc}\p{Cf}\p{M}]+$/u.test(char)) {
    return "Pick a visible character — a blank one makes redacted text look like empty space.";
  }
  // ASCII punctuation is Markdown syntax: runs of * - _ = render as dividers
  // or headings, ` and ~ open code blocks, and %% or $$ can hide or swallow
  // the rest of the note.
  if (/^[\x21-\x2F\x3A-\x40\x5B-\x60\x7B-\x7E]$/.test(char)) {
    return "Markdown symbols like * - # ~ can turn redacted text into formatting. Try a lookalike instead — ✱ Heavy asterisk is in the list above.";
  }
  return undefined;
}

/**
 * Turns `input` into its redacted form according to the configured style:
 *
 *   per-character   — every character becomes the block character; newlines
 *                     are kept so multi-line text keeps its shape.
 *   preserve-spaces — like per-character, but spaces are also kept, so word
 *                     boundaries stay visible (leaks word lengths).
 *   fixed-length    — each line collapses to a constant run of blocks, so
 *                     line lengths don't leak (line breaks are kept).
 *
 * Blank lines stay blank in every style.
 *
 * Characters are counted as graphemes (see splitGraphemes), so each visible
 * character becomes exactly one block.
 */
export function redactString(input: string, settings: RedactPluginSettings): string {
  const { blockChar, redactionStyle } = settings;

  return input
    .split("\n")
    .map((line) => {
      if (line.length === 0) return line; // blank lines stay blank
      if (redactionStyle === "fixed-length") return blockChar.repeat(FIXED_LENGTH);
      return redactionStyle === "preserve-spaces"
        ? splitGraphemes(line).map((ch) => (ch === " " ? " " : blockChar)).join("")
        : blockChar.repeat(splitGraphemes(line).length);
    })
    .join("\n");
}
