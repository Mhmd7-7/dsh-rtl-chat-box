# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.1] - 2026-09-22

### Fixed

- **List markers in Auto follow the item's own language.** A `::marker` with
  `list-style-position: inside` is placed by the item's `direction` property,
  which `unicode-bidi: plaintext` never changes, so an Arabic item's number could
  stay on the left. In Auto, every `li` in the transcript and in the composer that
  has no `dir` of its own is now given `dir="auto"`, and a `MutationObserver`
  covers items added later (a new message, or Enter inside the editor). Leaving
  Auto — or unloading the plugin — removes only the `dir` values the plugin wrote,
  never one the editor set itself.

## [0.1.0] - 2026-09-18

First public release.

### Added

- A **Chat box direction** row in Settings → General with three modes: **RTL**,
  **LTR**, and **Auto**.
- **Smart bidi**: `unicode-bidi: plaintext` on the chat box, so mixed
  Arabic/English inside one message keeps correct ordering. Forced on in Auto.
- **Also message text**: extends the chosen direction to sent messages and
  transcript paragraphs. Forced on in Auto.
- Per-item list markers in Auto: an Arabic item puts its number on the right
  with its text, an English item keeps it on the left.
- RTL mirroring for blockquote bars and task-list checkbox gaps, and LTR pinning
  for `pre` / `code` / `kbd` / `samp` so code never scrambles.
- The direction choice is stored in `localStorage` under `dsh-rtl-chat-box`, so
  it survives a page reload.

### Notes

- The plugin ships prebuilt (`lib/index.js`, `lib/client.js`) with no build step
  and no runtime npm dependencies; `@deepseek-ai/cordis` is a peer dependency.
- Only a `<style>` element is added to `document.head`; the page root is never
  touched, and the element is removed when the plugin's fiber is disposed.
- `dsh.bundle.patch` + `cordis.patch.yml` make the package installable through
  `dsh plugin --profile web add`.

[Unreleased]: https://github.com/Mhmd7-7/dsh-rtl-chat-box/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/Mhmd7-7/dsh-rtl-chat-box/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/Mhmd7-7/dsh-rtl-chat-box/releases/tag/v0.1.0
