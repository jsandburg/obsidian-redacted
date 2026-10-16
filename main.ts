import {
  Editor,
  EditorChange,
  MarkdownFileInfo,
  MarkdownView,
  Menu,
  Notice,
  Plugin,
  TFile,
  TFolder,
  normalizePath,
} from "obsidian";
import { RedactPluginSettings, DEFAULT_SETTINGS, RedactSettingTab } from "./settings";
import { redactString } from "./redact";

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export default class RedactPlugin extends Plugin {
  settings!: RedactPluginSettings;
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
      // In reading view the editor still holds its last selection, but the
      // user can't see it — don't redact text they didn't knowingly select.
      // (The command is hidden in reading view by editorCallback already.)
      if (view.getMode() !== "source") {
        new Notice("Switch to editing view to redact a selection.");
        return;
      }
      this.runRedactSelection(view.editor, view.file);
    });

    this.addCommand({
      id: "selection",
      name: "Redact selection",
      editorCallback: (editor: Editor, ctx: MarkdownView | MarkdownFileInfo) => {
        this.runRedactSelection(editor, ctx.file);
      },
    });

    // Right-click menu entry, shown only when there is something to redact
    // and redaction is allowed in the note (see isRedactionAllowed).
    this.registerEvent(
      this.app.workspace.on(
        "editor-menu",
        (menu: Menu, editor: Editor, info: MarkdownView | MarkdownFileInfo) => {
          if (
            this.redactionChanges(editor).length === 0 ||
            !this.isRedactionAllowed(info.file)
          )
            return;
          menu.addItem((item) =>
            item
              .setTitle("Redact selection")
              .setIcon("eraser")
              .onClick(() => this.runRedactSelection(editor, info.file))
          );
        }
      )
    );

    // Keep limited and excluded folders pointing at the same folders when those are
    // renamed or moved — otherwise redaction would silently stop there.
    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        if (file instanceof TFolder) void this.followFolderRename(oldPath, file.path);
      })
    );
  }

  // -------------------------------------------------------------------------
  // Folder scoping ("Limited folders" and "Excluded folders")
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
   * True when redaction is allowed in `file`.
   *
   * The file is passed in by the caller — taken from the editor the command
   * actually ran against — rather than read from workspace.getActiveFile(),
   * which can name a different note when editors are open in pop-out windows.
   *
   * normalizePath() is applied here, at comparison time, so the stored value
   * can stay exactly as the user typed it. The trailing slash prevents
   * "Private" from matching "Private Archive".
   */
  isInLimitedFolder(file: TFile | null): boolean {
    const folders = this.limitedFolders();
    if (folders.length === 0) return true; // no folders set → apply everywhere

    // The vault root means "everywhere". It has to be caught before the
    // prefix test below: normalizePath() strips slashes, so the root would
    // otherwise be compared as "//" (or "/") and match no file at all,
    // silently disabling redaction in the whole vault.
    const normalized = folders.map((folder) => normalizePath(folder.trim()));
    if (normalized.some((folder) => folder === "/" || folder === "")) return true;

    if (!file) return false;

    return normalized.some((folder) => file.path.startsWith(folder + "/"));
  }

  /** True when `file` is inside any of the excluded folders. */
  isInExcludedFolder(file: TFile | null): boolean {
    if (!file) return false;
    return this.settings.excludedFolders
      .filter((f) => f.trim())
      .some((folder) => file.path.startsWith(normalizePath(folder.trim()) + "/"));
  }

  /**
   * True when redaction is allowed in `file`: it is in a limited folder (or
   * none are set) and not in an excluded folder. Excluded folders win, so a
   * subfolder of a limited folder can be excluded.
   */
  isRedactionAllowed(file: TFile | null): boolean {
    return this.isInLimitedFolder(file) && !this.isInExcludedFolder(file);
  }

  /**
   * Rewrites limited and excluded folders at or under `oldPath` to sit under
   * `newPath` — the renamed folder itself, and entries inside it
   * ("Work/Private" when "Work" is renamed). Repeating it for the same rename
   * changes nothing.
   */
  private async followFolderRename(oldPath: string, newPath: string): Promise<void> {
    let changed = false;
    const update = (folders: string[]) =>
      folders.map((entry) => {
        const folder = normalizePath(entry.trim());
        if (folder !== oldPath && !folder.startsWith(oldPath + "/")) return entry;
        changed = true;
        return newPath + folder.slice(oldPath.length);
      });
    this.settings.watchedFolders = update(this.settings.watchedFolders);
    this.settings.excludedFolders = update(this.settings.excludedFolders);
    if (changed) await this.saveSettings();
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
   * One change per non-empty selection, replacing it with its redacted form.
   *
   * Each range is read and replaced on its own because, with multiple
   * cursors, editor.getSelection() returns only the main selection while
   * replaceSelection() writes the same text over every selection — which
   * would give every range the main one's length and insert blocks at bare
   * cursors.
   */
  private redactionChanges(editor: Editor): EditorChange[] {
    const changes: EditorChange[] = [];
    for (const { anchor, head } of editor.listSelections()) {
      const [from, to] =
        editor.posToOffset(anchor) <= editor.posToOffset(head)
          ? [anchor, head]
          : [head, anchor];
      const selected = editor.getRange(from, to);
      if (selected) {
        changes.push({ from, to, text: redactString(selected, this.settings) });
      }
    }
    return changes;
  }

  /**
   * Redacts every selection in place, in a single undoable transaction.
   * Each selection is replaced according to the configured redaction style
   * (see redactString).
   */
  private runRedactSelection(editor: Editor, file: TFile | null): void {
    if (this.isInExcludedFolder(file)) {
      new Notice("Redacted is turned off in this folder.");
      return;
    }
    if (!this.isInLimitedFolder(file)) {
      this.notifyOutsideLimitedFolders();
      return;
    }

    const changes = this.redactionChanges(editor);

    if (changes.length === 0) {
      new Notice("No text selected.");
      return;
    }

    editor.transaction({ changes });
    new Notice("Redacted selection.");
  }

  // -------------------------------------------------------------------------
  // Settings persistence
  // -------------------------------------------------------------------------

  async loadSettings() {
    const data = (await this.loadData()) as Partial<RedactPluginSettings> | null;
    // Copy the default arrays so adding a folder never mutates DEFAULT_SETTINGS.
    this.settings = { ...DEFAULT_SETTINGS, watchedFolders: [], excludedFolders: [], ...data };
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
