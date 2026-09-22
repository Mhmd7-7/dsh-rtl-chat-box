# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.4.0] - 2026-09-22

### Added

- **A direction button in the question card.** The card is the one surface where a
  direction can be wrong for a reason the mode cannot know: a reply in Arabic
  arrives, the mode is **RTL**, and this one question is in English. The card's
  header now carries a small **RTL** / **LTR** button that reports the direction the
  card has at that moment and swaps it for the other one on a click, so the question,
  its options and its answer field turn around without leaving the card. It corrects
  that card alone: the transcript, the composer and the settings row keep the mode
  they were given, and the choice lives in memory rather than in the stored
  preference — it is a correction applied to the question in front of you, not a
  setting. The button sits with the card's own minimise and close buttons, stays
  single across the GUI's re-renders, and is removed when the plugin is disposed.

## [0.3.0] - 2026-09-22

### Added

- **The question and its answers now follow the mode.** 0.2.0 gave the *text*
  inside an `ask_user_question` card a direction of its own, but the card itself
  had none, so an Arabic question still laid out left-to-right with its option
  numbers on the left. The card now takes one direction of its own — forced by
  **RTL** / **LTR**, computed from its own text in **Auto** — and that turns the
  whole card around: the header actions move to the other edge, an option row lays
  its number, label and description out from the other edge, and the footer swaps
  its buttons. The direction is re-read whenever the card's text changes, so a
  card rewritten in another language follows it.
- The answer field follows what is typed in every mode: Arabic right-to-left,
  English left-to-right.

### Fixed

- **An empty answer field left an Arabic card's placeholder on the left.**
  `dir="auto"` has no strong character to read in an empty field and falls back to
  LTR; while the placeholder is showing, the field now takes the card's direction
  instead.
- A question detail's list keeps its 18px indent but gains it on the marker's own
  side, so a right-to-left card no longer draws its number outside the indent —
  and a horizontal scrollbar of the card body with it (measured: 4px of overflow).

## [0.2.0] - 2026-09-22

### Added

- **Auto now governs the `ask_user_question` card too.** The card is mounted into
  the composer slot, so it is neither the transcript nor the composer host, and in
  Auto its Arabic question, detail, option labels and free-text answer field kept
  the page's left-to-right direction. Every element in the card that carries text
  of its own — and the answer field — now takes `dir="auto"`, so a question follows
  its own language exactly like the chat next to it, while an English answer field
  stays left-to-right as you type. The card's flex rows (an option's number beside
  its label, the custom-answer row) carry no text of their own and are never marked,
  so no row mirrors; list items inside a question detail keep the GUI's markdown
  layout, whose physical left padding leaves a right-side marker no gutter
  (measured: 4px of overflow). RTL and LTR are unchanged.

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

[Unreleased]: https://github.com/Mhmd7-7/dsh-rtl-chat-box/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/Mhmd7-7/dsh-rtl-chat-box/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/Mhmd7-7/dsh-rtl-chat-box/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/Mhmd7-7/dsh-rtl-chat-box/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/Mhmd7-7/dsh-rtl-chat-box/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/Mhmd7-7/dsh-rtl-chat-box/releases/tag/v0.1.0
