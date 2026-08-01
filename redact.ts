import type { RedactPluginSettings } from "./settings";

/** Number of block characters used in fixed-length mode. */
export const FIXED_LENGTH = 5;

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
 * Character counting uses the spread operator ([...str]) so that multi-byte
 * Unicode characters (emoji, accented letters, etc.) count as one character
 * each rather than two surrogate halves.
 */
export function redactString(input: string, settings: RedactPluginSettings): string {
  const { blockChar, redactionStyle } = settings;

  return input
    .split("\n")
    .map((line) => {
      if (line.length === 0) return line; // blank lines stay blank
      if (redactionStyle === "fixed-length") return blockChar.repeat(FIXED_LENGTH);
      return redactionStyle === "preserve-spaces"
        ? [...line].map((ch) => (ch === " " ? " " : blockChar)).join("")
        : blockChar.repeat([...line].length);
    })
    .join("\n");
}
