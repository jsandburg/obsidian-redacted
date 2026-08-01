# Redacted

An [Obsidian](https://obsidian.md) plugin that permanently replaces selected text with Full Block characters (█).

Select some text and run **Redact selection** (command palette, right-click menu, or the eraser ribbon icon) — the selection is immediately replaced with blocks:

```
My password is hunter2 and my cat's name is Miso.
```

becomes (with "my password" selected up through `hunter2`):

```
My password is ███████ and my cat's name is Miso.
```

## Settings

- **Limited folders** — restrict redaction to notes inside specific folders. Enter folder names exactly as they appear in your vault (e.g. `Private` or `Notes/Sensitive`). Leave the list empty to allow redaction anywhere. Running the command outside a limited folder shows a notice instead of silently doing nothing.
- **Redaction style** — *Per character* (one block per character, newlines kept), *Preserve spaces* (spaces stay visible so word boundaries remain — note this reveals word lengths), or *Fixed length* (each line becomes a constant run of 5 blocks, so line lengths don't leak).
- **Redaction character** — the character used for replacement. Default: █ (U+2588 Full Block). Alternatives: ░ ▒ ▓ ■
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

Until the plugin is available in the community directory, install it manually:

1. Create the folder `<your vault>/.obsidian/plugins/redacted/`
2. Copy `main.js`, `manifest.json`, and `styles.css` into it
3. Reload Obsidian and enable **Redacted** under Settings → Community plugins

## Development

This is a TypeScript project. To build:

```
npm install
npm run build
```

This produces `main.js` from `main.ts` and `settings.ts` via esbuild.

## License

MIT
