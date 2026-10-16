import {
  App,
  FuzzySuggestModal,
  PluginSettingTab,
  Setting,
  SettingDefinitionItem,
  SettingDefinitionList,
  TFolder,
  normalizePath,
} from "obsidian";
import type RedactPlugin from "./main";
import { redactString, blockCharError, FIXED_LENGTH } from "./redact";

export type RedactionStyle = "per-character" | "preserve-spaces" | "fixed-length";

export interface RedactPluginSettings {
  blockChar: string;
  /**
   * How the selection is replaced:
   *   per-character   — one block per character (newlines kept)
   *   preserve-spaces — like per-character, but spaces stay visible
   *   fixed-length    — a constant run of blocks; hides the original length
   */
  redactionStyle: RedactionStyle;
  /**
   * User-facing name: "Limited folders".
   * The key stays `watchedFolders` for backward compatibility with settings
   * saved by earlier versions — renaming it would silently discard users'
   * existing folder lists.
   */
  watchedFolders: string[];
  /** Redaction is off in these, even inside a limited folder. */
  excludedFolders: string[];
}

/** The settings keys that hold a list of folders. */
type FolderListKey = "watchedFolders" | "excludedFolders";

export const DEFAULT_SETTINGS: RedactPluginSettings = {
  blockChar: "█",
  redactionStyle: "per-character",
  watchedFolders: [],
  excludedFolders: [],
};

/** The "Redaction style" description for each style, shown for the selected one. */
const STYLE_DESCS: Record<RedactionStyle, string> = {
  "per-character":
    "Replaces each character with the redaction character, keeping line " +
    "breaks. The redaction is one-to-one, so it shows how long the original " +
    "text was.",
  "preserve-spaces":
    "Like per character, but spaces stay visible so word boundaries remain " +
    "— note this reveals word lengths, which makes short phrases easier to guess.",
  "fixed-length":
    `Replaces each line with ${FIXED_LENGTH} redaction characters, so no ` +
    "word or line lengths leak.",
};

const PRESET_CHARS: [string, string][] = [
  ["█", "█ Full block"],
  ["░", "░ Light shade"],
  ["▒", "▒ Medium shade"],
  ["▓", "▓ Dark shade"],
  ["■", "■ Black square"],
  ["●", "● Black circle"],
  ["★", "★ Black star"],
  ["✦", "✦ Four-pointed star"],
  ["✱", "✱ Heavy asterisk"],
];

/** Fuzzy picker over the vault's folders, for adding a folder to a list. */
class FolderPickerModal extends FuzzySuggestModal<TFolder> {
  constructor(
    app: App,
    placeholder: string,
    private exclude: string[],
    private onPick: (folder: TFolder) => void
  ) {
    super(app);
    this.setPlaceholder(placeholder);
  }

  getItems(): TFolder[] {
    // The vault root isn't offered: limiting to it is what an empty limited
    // list already does, and excluding it would turn redaction off everywhere.
    return this.app.vault
      .getAllFolders(false)
      .filter((folder) => !this.exclude.includes(folder.path));
  }

  getItemText(folder: TFolder): string {
    return folder.path;
  }

  onChooseItem(folder: TFolder): void {
    this.onPick(folder);
  }
}

export class RedactSettingTab extends PluginSettingTab {
  plugin: RedactPlugin;
  /** True while the "Custom…" redaction-character option is selected. */
  private customMode = false;

  constructor(app: App, plugin: RedactPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  getControlValue(key: string): unknown {
    return this.plugin.settings[key as keyof RedactPluginSettings];
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    (this.plugin.settings as unknown as Record<string, unknown>)[key] = value;
    await this.plugin.saveSettings();
    if (this.plugin.onSettingsChange) this.plugin.onSettingsChange();
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    const isPreset = PRESET_CHARS.some(
      ([ch]) => ch === this.plugin.settings.blockChar
    );

    return [
      {
        name: "",
        desc:
          "Select text and run the \"Redact selection\" command (or right-click " +
          "→ Redact selection) to permanently replace it with redaction characters.",
        searchable: false,
      },
      this.folderList({
        key: "watchedFolders",
        heading: "Limited folders",
        emptyState:
          "No folders listed — redaction is available in every note. Add a " +
          "folder to allow redaction only there.",
        placeholder: "Pick a folder to limit redaction to",
      }),
      this.folderList({
        key: "excludedFolders",
        heading: "Excluded folders",
        emptyState:
          "No folders excluded. Add a folder to turn redaction off in it, " +
          "even when it's inside a limited folder.",
        placeholder: "Pick a folder to exclude",
      }),
      {
        type: "group",
        heading: "Appearance",
        items: [
          {
            name: "Redaction style",
            desc: STYLE_DESCS[this.plugin.settings.redactionStyle],
            render: (setting: Setting) => {
              setting.addDropdown((dropdown) =>
                dropdown
                  .addOption("per-character", "Per character")
                  .addOption("preserve-spaces", "Preserve spaces")
                  .addOption("fixed-length", "Fixed length")
                  .setValue(this.plugin.settings.redactionStyle)
                  .onChange(async (value) => {
                    this.plugin.settings.redactionStyle = value as RedactionStyle;
                    setting.setDesc(STYLE_DESCS[value as RedactionStyle]);
                    await this.plugin.saveSettings();
                    if (this.plugin.onSettingsChange) this.plugin.onSettingsChange();
                  })
              );
            },
          },
          {
            name: "Redaction character",
            desc: "The character used to replace the original text.",
            render: (setting: Setting) => {
              setting.addDropdown((dropdown) => {
                for (const [ch, label] of PRESET_CHARS) dropdown.addOption(ch, label);
                dropdown
                  .addOption("custom", "Custom…")
                  .setValue(
                    this.customMode || !isPreset
                      ? "custom"
                      : this.plugin.settings.blockChar
                  )
                  .onChange(async (value) => {
                    this.customMode = value === "custom";
                    if (value !== "custom") {
                      this.plugin.settings.blockChar = value;
                      await this.plugin.saveSettings();
                    }
                    // Re-render so the custom text field appears or
                    // disappears. (Selecting Custom… keeps the current
                    // character until one is typed.)
                    this.update();
                  });
              });
            },
          },
          {
            name: "Custom character",
            desc: "Type or paste any single character (e.g. ♥, ☀, x).",
            visible: () => this.customMode || !isPreset,
            // Persisted through setControlValue. The framework shows the
            // validate message inline and only saves values that pass; it
            // also flags an invalid value saved by an earlier version.
            control: {
              type: "text" as const,
              key: "blockChar",
              placeholder: "█",
              validate: blockCharError,
            },
          },
          {
            name: "Preview",
            searchable: false,
            render: (setting: Setting) => {
              // Stack the preview under its label — the sample needs the full
              // width of the row, not the narrow control column.
              setting.settingEl.addClass("redact-preview-item");
              // Empty first: render runs again on every update(), and without
              // this each pass would append another (stale) preview element.
              setting.controlEl.empty();
              const previewEl = setting.controlEl.createEl("code", {
                cls: "redact-preview-code",
              });
              const updatePreview = () => {
                previewEl.textContent = `Hello, world!  →  ${redactString(
                  "Hello, world!",
                  this.plugin.settings
                )}`;
              };
              updatePreview();
              this.plugin.onSettingsChange = updatePreview;
              // Release the preview-updater closure when the row is torn
              // down, so the plugin doesn't hold a reference to detached DOM.
              return () => {
                this.plugin.onSettingsChange = null;
              };
            },
          },
        ],
      },
    ];
  }

  /**
   * A list of vault folders stored under the given settings key. Each row is
   * the folder's path; the add button opens a picker of the vault's folders.
   */
  private folderList(options: {
    key: FolderListKey;
    heading: string;
    emptyState: string;
    /** Shown in the folder picker's search box. */
    placeholder: string;
  }): SettingDefinitionList {
    // Read the array from settings each time: a folder rename replaces it
    // (see followFolderRename), so a captured copy would go stale.
    const folders = () => this.plugin.settings[options.key];
    const changed = () => {
      void this.plugin.saveSettings();
      this.update();
    };

    return {
      type: "list",
      heading: options.heading,
      emptyState: options.emptyState,
      addItem: {
        name: "Add folder",
        action: () => {
          new FolderPickerModal(this.app, options.placeholder, folders(), (folder) => {
            folders().push(folder.path);
            changed();
          }).open();
        },
      },
      onDelete: (index) => {
        folders().splice(index, 1);
        changed();
      },
      // Plain rows named by path. A folder deleted since it was picked (or
      // a hand-typed entry from an earlier version) would silently stop
      // applying — flag it. Renames are followed in main.ts.
      items: folders().map((folder) => ({
        name: folder || "(blank)",
        desc:
          folder.trim() && !this.app.vault.getFolderByPath(normalizePath(folder.trim()))
            ? "No such folder in this vault."
            : undefined,
        searchable: false,
      })),
    };
  }
}
