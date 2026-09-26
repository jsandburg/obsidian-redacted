# Redacted

An [Obsidian](https://obsidian.md) plugin that permanently replaces selected text with block characters — the classic declassified-document look, right in your notes.

Select some text and run **Redact selection** — from the command palette, the right-click menu, or the eraser ribbon icon — and the selection is immediately replaced:

```
My password is hunter2 and my cat's name is Miso.
```

becomes (with `hunter2` selected):

```
My password is ███████ and my cat's name is Miso.
```

## Features

- **Three ways to redact** — command palette, right-click context menu (appears whenever text is selected), or the eraser ribbon icon.
- **Three redaction styles**:
  - *Per character* (default) — one block per character, so the redaction is one-to-one: `secret name` → `███████████`
  - *Preserve spaces* — spaces stay visible so word boundaries remain: `secret name` → `██████ ████`
  - *Fixed length* — each line becomes a constant run of 5 blocks, so no word or line length leaks: `secret name` → `█████`
- **Choice of redaction character** — pick from a dropdown of presets (█ ░ ▒ ▓ ■ ● ★ ✦ ✱), or choose *Custom…* and type or paste any single character (♥, ☀, an emoji…).
- **Limited folders** — optionally restrict redaction to specific folders, picked from a vault-folder suggester, so the command is only active where it's meant to be used.
- **Live preview** — the settings tab shows a before/after example of your current style and character.
- **Multiple selections** — hold **Option** (Alt on Windows/Linux) and drag to add more selections, then redact them all at once. Each is redacted to its own length, in a single undoable step.
- **Shape-preserving** — multi-line selections keep their line breaks in every style, and blank lines stay blank.
- **Searchable settings** — built on Obsidian's declarative settings API, so every option shows up in the global settings search.

## Settings

- **Limited folders** — restrict redaction to notes inside specific folders. Add a row with the list's **+** control, then pick a folder from the suggester (or type a path like `Notes/Sensitive`); remove one with its **✕**. Leave the list empty — or add the vault root (`/`) — to allow redaction anywhere. Renaming or moving a limited folder updates the list automatically; a folder that doesn't exist in the vault (a typo, or one deleted since) is flagged with an inline warning. Running the command outside a limited folder shows a notice instead of silently doing nothing.
- **Redaction style** — *Per character*, *Preserve spaces*, or *Fixed length* (see above). Note that *Preserve spaces* reveals word lengths, which makes short redacted phrases easier to guess.
- **Redaction character** — the preset dropdown, plus *Custom…* for any single character. Blank or invisible characters and Markdown symbols (ASCII punctuation such as `*` `-` `#` `~`) aren't accepted: the first would make redacted text look like empty space, the second can turn it into formatting — a divider, a heading, or a code block. For an asterisk look, use the ✱ *Heavy asterisk* preset instead of `*`.
- **Preview** — a live before/after example showing your current redaction style and character in action.

## Important: what "permanent" does and doesn't mean

Redaction rewrites the text in your note. The original characters are gone from the note itself — but copies of them can survive elsewhere:

- **Undo history**: Ctrl+Z / Cmd+Z restores the original text for as long as the note's editor history exists. Close and reopen the note (or restart Obsidian) if you want the undo path gone.
- **File Recovery**: Obsidian's built-in File Recovery core plugin keeps periodic snapshots of your notes. A snapshot taken before redaction still contains the original text until it expires or you clear it.
- **Sync and backups**: any sync service, version control system (e.g. a Git repository), or backup tool may retain pre-redaction copies of the file.
- **Length disclosure**: in the per-character styles, the *length* of the redacted text remains visible. `███` tells a reader the secret was three characters long. Use the *Fixed length* redaction style if length itself is sensitive.

Treat Redacted as a presentation tool for notes you share or publish, not as a substitute for proper secrets management.

## Edge cases worth knowing

- **Emoji and accents**: characters are counted as you see them, so an emoji built from several code points (👨‍👩‍👧, 👍🏽, a flag) or a letter with a combining accent becomes exactly one block.
- **Multi-line selections**: line breaks are preserved so redacted text keeps its shape, and blank lines stay blank.
- **Reading view**: redaction only works in editing view, where you can see what's selected.

## Installation

Requires Obsidian 1.13.0 or later.

Until the plugin is available in the community directory, install it manually:

1. Create the folder `<your vault>/.obsidian/plugins/redacted/`
2. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/jsandburg/obsidian-redacted/releases/latest) and copy them into it
3. Reload Obsidian and enable **Redacted** under Settings → Community plugins

## Development

This is a TypeScript project. To build:

```
npm install
npm run build
```

This typechecks with `tsc` and bundles the sources into `main.js` via esbuild. `npm run dev` rebuilds `main.js` on every change instead.

To lint with [`eslint-plugin-obsidianmd`](https://github.com/obsidianmd/eslint-plugin) — the same rules the community plugin review uses:

```
npm run lint
```

To release, bump the version in `manifest.json`, `package.json`, and `versions.json`, then push a tag that matches it exactly (e.g. `1.0.8`, no `v` prefix). The release workflow lints, builds, and publishes `main.js`, `manifest.json`, and `styles.css` with build provenance attestations.

## License

MIT
