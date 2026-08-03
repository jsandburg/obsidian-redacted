import { Editor, MarkdownView, Menu, Notice, Plugin, normalizePath } from "obsidian";
import { RedactPluginSettings, DEFAULT_SETTINGS, RedactSettingTab } from "./settings";
import { redactString } from "./redact";

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
        new Notice("No active Markdown note found.");
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

    // The vault root means "everywhere". It has to be caught before the
    // prefix test below: normalizePath() strips slashes, so the root would
    // otherwise be compared as "//" (or "/") and match no file at all,
    // silently disabling redaction in the whole vault.
    const normalized = folders.map((folder) => normalizePath(folder.trim()));
    if (normalized.some((folder) => folder === "/" || folder === "")) return true;

    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) return false;

    return normalized.some((folder) => activeFile.path.startsWith(folder + "/"));
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
    const data = (await this.loadData()) as Partial<RedactPluginSettings> | null;
    this.settings = { ...DEFAULT_SETTINGS, ...data };
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
