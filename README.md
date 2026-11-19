# Redacted

An [Obsidian](https://obsidian.md) plugin that replaces selected text with block characters, or any character you choose — the declassified-document look, right in your notes.

Select `hunter2` and run **Redact selection**:

```
My password is hunter2 and my cat's name is Miso.
My password is ███████ and my cat's name is Miso.
```

The text in the note is rewritten, not just hidden. Read [what redaction doesn't erase](#what-redaction-doesnt-erase) before relying on it.

## Usage

Select text in editing view, then run **Redact selection** from any of:

- the command palette
- the right-click menu (shown when text is selected)
- the eraser icon in the ribbon

To redact several selections at once, hold **Option** (Alt on Windows/Linux) and drag to add selections. Each one is redacted to its own length, and the whole operation is a single undo step.

Redaction doesn't run in reading view, where you can't see what is selected.

## Settings

### Redaction style

| Style | `secret name` becomes | What still shows |
| --- | --- | --- |
| Per character (default) | `███████████` | The length of the text |
| Preserve spaces | `██████ ████` | The length of each word |
| Fixed length | `█████` | Nothing about the line's length |

Line breaks are kept in every style and blank lines stay blank, so the number of lines always shows. *Fixed length* turns each line into 5 redaction characters.

### Redaction character

Pick a preset (█ ░ ▒ ▓ ■ ● ★ ✦ ✱) or choose **Custom…** and type or paste any single character, including an emoji.

Two kinds of character aren't accepted:

- **Blank or invisible characters**, which would make redacted text look like empty space.
- **Markdown symbols** (ASCII punctuation such as `*` `-` `#` `~`), which can turn redacted text into a divider, a heading, or a code block. For an asterisk look, use the ✱ *Heavy asterisk* preset.

### Limited folders

Restrict redaction to notes inside specific folders. Leave the list empty to allow it everywhere. Running the command outside a limited folder shows a notice.

### Excluded folders

Turn redaction off in specific folders. Exclusion wins over a limited folder, so you can allow redaction in a folder but not in one of its subfolders.

Both lists are filled from a folder picker and follow folders when you rename or move them. A folder that no longer exists is flagged under its row.

### Preview

A before/after sample of the current style and character.

## What redaction doesn't erase

Redaction removes the original characters from the note itself. Copies can survive elsewhere:

- **Undo history**: Ctrl+Z / Cmd+Z restores the text for as long as the note's editor history exists. Close and reopen the note, or restart Obsidian, to clear it.
- **File Recovery**: Obsidian's File Recovery core plugin keeps periodic snapshots. One taken before redaction still holds the original text until it expires or you clear it.
- **Sync and backups**: a sync service, a Git repository, or a backup tool may keep earlier copies of the file.
- **Length and shape**: the per-character styles show how long the text was, and every style shows how many lines it had.

Treat Redacted as a presentation tool for notes you share or publish, not as a substitute for secrets management.

## How characters are counted

Characters are counted as you see them. An emoji built from several code points (👨‍👩‍👧, 👍🏽, a flag) or a letter with a combining accent becomes exactly one redaction character.

## Installation

Requires Obsidian 1.13.0 or later.

Until the plugin is in the community directory, install it manually:

1. Create the folder `<your vault>/.obsidian/plugins/redacted/`.
2. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/jsandburg/obsidian-redacted/releases/latest) and copy them into it.
3. Reload Obsidian and enable **Redacted** under Settings → Community plugins.

## Development

```
npm install
npm run build
```

`npm run build` typechecks with `tsc` and bundles the sources into `main.js` with esbuild. `npm run dev` rebuilds on every change. `npm run lint` runs [`eslint-plugin-obsidianmd`](https://github.com/obsidianmd/eslint-plugin), the rules the community plugin review uses.

To release, bump the version in `manifest.json`, `package.json`, and `versions.json`, then push a tag that matches it exactly (for example `1.0.8`, with no `v` prefix). The release workflow lints, builds, and publishes `main.js`, `manifest.json`, and `styles.css` with build provenance attestations.

## License

MIT
