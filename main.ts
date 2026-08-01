import { Editor, MarkdownView, Menu, Notice, Plugin, normalizePath } from "obsidian";
import { RedactPluginSettings, DEFAULT_SETTINGS, RedactSettingTab, FIXED_LENGTH } from "./settings";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export default class RedactPlugin extends Plugin {
  settings: RedactPluginSettings;
  onSettingsChange: (() => void) | null = null;

  async onload() {
    await this.loadSettings();

    this.addSettingTab(new RedactSettingTab(this.app, this));

    this.addRibbonIcon("eraser", "Redact selection", () => {
      const view = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (!view) {
        new Notice("No active markdown note found.");
        return;
      }
      this.runRedactSelection(view.editor);
    });

    this.addCommand({
      id: "selection",
      name: "Redact selection",
      editorCallback: (editor: Editor, _view: MarkdownView) => {
        this.runRedactSelection(editor);
      },
    });

    // Right-click menu entry, shown only when there is something to redact
    // and the note is inside a limited folder (or no folders are set).
    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu: Menu, editor: Editor) => {
        if (!editor.getSelection() || !this.isInLimitedFolder()) return;
        menu.addItem((item) =>
          item
            .setTitle("Redact selection")
            .setIcon("eraser")
            .onClick(() => this.runRedactSelection(editor))
        );
      })
    );
  }

  // -------------------------------------------------------------------------
  // Folder scoping ("Limited folders")
  // -------------------------------------------------------------------------

  /**
   * Returns the list of limited folders with blank entries stripped out.
   *
   * Note: the underlying settings key is still `watchedFolders` so that
   * existing saved data keeps working — only the user-facing name changed.
   */
  private limitedFolders(): string[] {
    return (this.settings.watchedFolders || []).filter((f) => f.trim());
  }

  /**
   * True when redaction is allowed in the active file.
   *
   * normalizePath() is applied here, at comparison time, so the stored value
   * can stay exactly as the user typed it. The trailing slash prevents
   * "Private" from matching "Private Archive".
   */
  isInLimitedFolder(): boolean {
    const folders = this.limitedFolders();
    if (folders.length === 0) return true; // no folders set → apply everywhere

    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) return false;

    return folders.some((folder) =>
      activeFile.path.startsWith(normalizePath(folder.trim()) + "/")
    );
  }

  /** Shows the standard "outside limited folders" notice. */
  private notifyOutsideLimitedFolders(): void {
    const folderList = this.limitedFolders()
      .map((f) => `"${f}"`)
      .join(", ");
    new Notice(`Redacted is only active in: ${folderList}.`);
  }

  // -------------------------------------------------------------------------
  // Command implementation
  // -------------------------------------------------------------------------

  /**
   * Redacts the current selection in place. The selection is replaced
   * according to the configured redaction style (see redactString).
   */
  private runRedactSelection(editor: Editor): void {
    if (!this.isInLimitedFolder()) {
      this.notifyOutsideLimitedFolders();
      return;
    }

    const selected = editor.getSelection();

    if (!selected) {
      new Notice("No text selected.");
      return;
    }

    editor.replaceSelection(redactString(selected, this.settings));
    new Notice("Redacted selection.");
  }

  // -------------------------------------------------------------------------
  // Settings persistence
  // -------------------------------------------------------------------------

  async loadSettings() {
    this.settings = { ...DEFAULT_SETTINGS, ...(await this.loadData()) };
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
