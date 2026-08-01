import { App, PluginSettingTab, Setting, SettingDefinitionItem } from "obsidian";
import type RedactPlugin from "./main";
import { redactString, FIXED_LENGTH } from "./redact";

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
}

export const DEFAULT_SETTINGS: RedactPluginSettings = {
  blockChar: "█",
  redactionStyle: "per-character",
  watchedFolders: [],
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
];

export class RedactSettingTab extends PluginSettingTab {
  plugin: RedactPlugin;
  /** True while the "Custom…" redaction-character option is selected. */
  private customMode = false;

  constructor(app: App, plugin: RedactPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  // The folder-list controls use indexed keys ("watchedFolders.0"); resolve
  // them onto the array. Other keys fall through to the settings object.
  getControlValue(key: string): unknown {
    const match = /^watchedFolders\.(\d+)$/.exec(key);
    if (match) return this.plugin.settings.watchedFolders[Number(match[1])];
    return this.plugin.settings[key as keyof RedactPluginSettings];
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    const match = /^watchedFolders\.(\d+)$/.exec(key);
    if (match) {
      // Store the raw trimmed value. Do NOT normalizePath() here:
      // normalizePath("") returns "/", which would survive the blank filter
      // and silently disable redaction everywhere. Paths are normalized at
      // comparison time instead (see isInLimitedFolder).
      this.plugin.settings.watchedFolders[Number(match[1])] = String(value).trim();
    } else {
      (this.plugin.settings as unknown as Record<string, unknown>)[key] = value;
    }
    await this.plugin.saveSettings();
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    const folders = this.plugin.settings.watchedFolders || [];
    const isPreset = PRESET_CHARS.some(
      ([ch]) => ch === this.plugin.settings.blockChar
    );

    return [
      {
        name: "",
        desc:
          "Select text and run the \"Redact selection\" command (or right-click " +
          "→ Redact selection) to permanently replace it with block characters.",
        searchable: false,
      },
      {
        type: "list",
        heading: "Limited folders",
        emptyState:
          "No folders listed — redaction is available in every note. Add a " +
          "folder (exactly as it appears in your vault, e.g. \"Private\" or " +
          "\"Notes/Sensitive\") to allow redaction only there.",
        addItem: {
          name: "Add folder",
          action: () => {
            this.plugin.settings.watchedFolders.push("");
            void this.plugin.saveSettings();
            this.update();
          },
        },
        onDelete: (index) => {
          this.plugin.settings.watchedFolders.splice(index, 1);
          void this.plugin.saveSettings();
          this.update();
        },
        items: folders.map((_folder, index) => ({
          name: `Folder ${index + 1}`,
          searchable: false,
          // Persisted through getControlValue/setControlValue below, which
          // map the indexed key onto the watchedFolders array. The folder
          // control provides a vault-folder suggester, so users pick real
          // folders instead of typing paths.
          control: {
            type: "folder" as const,
            key: `watchedFolders.${index}`,
            placeholder: "e.g. Private",
          },
        })),
      },
      {
        type: "group",
        heading: "Appearance",
        items: [
          {
            name: "Redaction style",
            desc:
              "Per character replaces each character with a block (newlines " +
              "kept). Preserve spaces also keeps spaces, so word boundaries " +
              "stay visible — note this reveals word lengths. Fixed length " +
              `replaces each line with ${FIXED_LENGTH} blocks, so line ` +
              "lengths don't leak.",
            render: (setting: Setting) => {
              setting.addDropdown((dropdown) =>
                dropdown
                  .addOption("per-character", "Per character")
                  .addOption("preserve-spaces", "Preserve spaces")
                  .addOption("fixed-length", "Fixed length")
                  .setValue(this.plugin.settings.redactionStyle)
                  .onChange(async (value) => {
                    this.plugin.settings.redactionStyle = value as RedactionStyle;
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
            desc: "Type or paste any single character (e.g. ✱, ♥, x).",
            visible: () => this.customMode || !isPreset,
            render: (setting: Setting) => {
              setting.addText((text) =>
                text
                  .setPlaceholder("█")
                  .setValue(this.plugin.settings.blockChar)
                  .onChange(async (value) => {
                    // Allow only a single character; take the first if more
                    // are typed. Spread handles multi-byte Unicode correctly.
                    const char = [...value][0];
                    if (!char) return;
                    this.plugin.settings.blockChar = char;
                    await this.plugin.saveSettings();
                    if (this.plugin.onSettingsChange) this.plugin.onSettingsChange();
                  })
              );
            },
          },
          {
            name: "Preview",
            searchable: false,
            render: (setting: Setting) => {
              const previewEl = setting.settingEl.createEl("code", {
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
}
