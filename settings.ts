import { App, PluginSettingTab, Setting } from "obsidian";
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

export class RedactSettingTab extends PluginSettingTab {
  plugin: RedactPlugin;
  /** True while the "Custom…" redaction-character option is selected. */
  private customMode = false;

  constructor(app: App, plugin: RedactPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // NOTE: No top-level "Redacted" heading here. Obsidian already shows the
    // plugin name above the settings tab, and the community guidelines say
    // not to repeat it.

    containerEl.createEl("p", {
      text:
        "Select text and run the \"Redact selection\" command (or right-click " +
        "→ Redact selection) to permanently replace it with block characters.",
      cls: "setting-item-description",
    });

    // --- Limited folders ---
    new Setting(containerEl).setName("Limited folders").setHeading();
    containerEl.createEl("p", {
      text:
        "Redaction commands are only available in notes inside these folders. " +
        "Use the exact folder name as it appears in your vault (e.g. \"Private\" or \"Notes/Sensitive\"). " +
        "Leave the list empty to allow redaction in any note.",
      cls: "setting-item-description",
    });

    const folders = this.plugin.settings.watchedFolders || [];

    // Render one row per existing folder
    folders.forEach((folder, index) => {
      new Setting(containerEl)
        .setName(`Folder ${index + 1}`)
        .addText((text) =>
          text
            .setPlaceholder("e.g. Private")
            .setValue(folder)
            .onChange(async (value) => {
              // Store the raw trimmed value. Do NOT normalizePath() here:
              // normalizePath("") returns "/", which would survive the blank
              // filter and silently disable redaction everywhere. Paths are
              // normalized at comparison time instead (see isInLimitedFolder).
              this.plugin.settings.watchedFolders[index] = value.trim();
              await this.plugin.saveSettings();
            })
        )
        .addButton((btn) =>
          btn
            .setButtonText("Remove")
            .setWarning()
            .onClick(async () => {
              this.plugin.settings.watchedFolders.splice(index, 1);
              await this.plugin.saveSettings();
              this.display();
            })
        );
    });

    // Add folder button
    new Setting(containerEl).addButton((btn) =>
      btn
        .setButtonText("Add folder")
        .setCta()
        .onClick(async () => {
          this.plugin.settings.watchedFolders.push("");
          await this.plugin.saveSettings();
          this.display();
        })
    );

    // --- Appearance ---
    new Setting(containerEl).setName("Appearance").setHeading();

    // --- Redaction style ---
    new Setting(containerEl)
      .setName("Redaction style")
      .setDesc(
        "Per character replaces each character with a block (newlines kept). " +
          "Preserve spaces also keeps spaces, so word boundaries stay visible " +
          "— note this reveals word lengths. Fixed length replaces the whole " +
          `selection with ${FIXED_LENGTH} blocks, so nothing about the ` +
          "original length leaks."
      )
      .addDropdown((dropdown) =>
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

    // --- Block character ---
    const PRESETS: [string, string][] = [
      ["█", "█ Full block"],
      ["░", "░ Light shade"],
      ["▒", "▒ Medium shade"],
      ["▓", "▓ Dark shade"],
      ["■", "■ Black square"],
      ["●", "● Black circle"],
      ["★", "★ Black star"],
      ["✦", "✦ Four-pointed star"],
    ];
    const isPreset = PRESETS.some(([ch]) => ch === this.plugin.settings.blockChar);
    // Custom mode stays on while the user is picking a character, even if the
    // current saved character happens to be a preset.
    const customMode = this.customMode || !isPreset;

    new Setting(containerEl)
      .setName("Redaction character")
      .setDesc("The character used to replace the original text.")
      .addDropdown((dropdown) => {
        for (const [ch, label] of PRESETS) dropdown.addOption(ch, label);
        dropdown
          .addOption("custom", "Custom…")
          .setValue(customMode ? "custom" : this.plugin.settings.blockChar)
          .onChange(async (value) => {
            this.customMode = value === "custom";
            if (value !== "custom") {
              this.plugin.settings.blockChar = value;
              await this.plugin.saveSettings();
            }
            // Re-render so the custom text field appears or disappears.
            // (Selecting Custom… keeps the current character until one is typed.)
            this.display();
          });
      });

    // Shown only in custom mode: type or paste any single character.
    if (customMode) {
      new Setting(containerEl)
        .setName("Custom character")
        .setDesc("Type or paste any single character (e.g. ✱, ♥, x).")
        .addText((text) =>
          text
            .setPlaceholder("█")
            .setValue(this.plugin.settings.blockChar)
            .onChange(async (value) => {
              // Allow only a single character; take the first if more are typed.
              // Spread handles multi-byte Unicode correctly.
              const char = [...value][0];
              if (!char) return;
              this.plugin.settings.blockChar = char;
              await this.plugin.saveSettings();
              if (this.plugin.onSettingsChange) this.plugin.onSettingsChange();
            })
        );
    }

    // --- Preview ---
    const previewSection = containerEl.createDiv({ cls: "redact-preview-section" });
    new Setting(previewSection).setName("Preview").setHeading();

    const updatePreview = () => {
      previewEl.textContent =
        `Hello, world!  →  ${redactString("Hello, world!", this.plugin.settings)}`;
    };

    const previewEl = previewSection.createEl("code", { cls: "redact-preview-code" });
    updatePreview();

    this.plugin.onSettingsChange = updatePreview;
  }

  hide(): void {
    // Release the preview-updater closure so the plugin doesn't hold a
    // reference to detached DOM after the settings tab closes.
    this.plugin.onSettingsChange = null;
  }
}
