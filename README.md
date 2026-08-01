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
- **Choice of redaction character** — pick from a dropdown of presets (█ ░ ▒ ▓ ■ ● ★ ✦), or choose *Custom…* and type or paste any single character (✱, ♥, an emoji…).
- **Limited folders** — optionally restrict redaction to specific folders, picked from a vault-folder suggester, so the command is only active where it's meant to be used.
- **Live preview** — the settings tab shows a before/after example of your current style and character.
- **Shape-preserving** — multi-line selections keep their line breaks in every style, and blank lines stay blank.
- **Searchable settings** — built on Obsidian's declarative settings API, so every option shows up in the global settings search.

## Settings

- **Limited folders** — restrict redaction to notes inside specific folders. Add a row with the list's **+** control, then pick a folder from the suggester (or type a path like `Notes/Sensitive`); remove one with its **✕**. Leave the list empty to allow redaction anywhere. Running the command outside a limited folder shows a notice instead of silently doing nothing.
- **Redaction style** — *Per character*, *Preserve spaces*, or *Fixed length* (see above). Note that *Preserve spaces* reveals word lengths, which makes short redacted phrases easier to guess.
- **Redaction character** — the preset dropdown, plus *Custom…* for any single character.
- **Preview** — a live before/after example showing your current redaction style and character in action.

## Important: what "permanent" does and doesn't mean

Redaction rewrites the text in your note. The original characters are gone from the note itself — but copies of them can survive elsewhere:

- **Undo history**: Ctrl+Z / Cmd+Z restores the original text for as long as the note's editor history exists. Close and reopen the note (or restart Obsidian) if you want the undo path gone.
- **File Recovery**: Obsidian's built-in File Recovery core plugin keeps periodic snapshots of your notes. A snapshot taken before redaction still contains the original text until it expires or you clear it.
- **Sync and backups**: any sync service, version control system (e.g. a Git repository), or backup tool may retain pre-redaction copies of the file.
- **Length disclosure**: in the per-character styles, the *length* of the redacted text remains visible. `███` tells a reader the secret was three characters long. Use the *Fixed length* redaction style if length itself is sensitive.

Treat Redacted as a presentation tool for notes you share or publish, not as a substitute for proper secrets management.

## Edge cases worth knowing

- **Complex emoji**: characters made of multiple code points joined together (like family emoji 👨‍👩‍👧) count as several characters, so one visible glyph may become several blocks. Simple emoji and accented characters count correctly as one.
- **Multi-line selections**: line breaks are preserved so redacted text keeps its shape, and blank lines stay blank.

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

This typechecks with `tsc` and bundles the sources into `main.js` via esbuild.

## License

MIT
