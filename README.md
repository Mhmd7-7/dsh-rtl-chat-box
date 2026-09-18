# dsh-rtl-chat-box

Right-to-left **chat box** for the dsh web GUI — for writing Arabic (or any RTL
script) in the composer, and back to English.

It changes **only the chat text box**, never the page root: the sidebar, columns,
and every other surface keep their normal left-to-right layout.

## Controls

Settings → General → **Chat box direction**

| Control | Effect |
| --- | --- |
| **RTL** | The chat box becomes right-to-left: caret, alignment, and reading order. |
| **LTR** | The chat box is left-to-right again. |
| **Auto** | Everything follows whatever you type — Arabic reads RTL, English stays LTR. Each list item, paragraph, and typed line follows its own language, in the box *and* in message text. |
| **Smart bidi** | Mixed Arabic/English inside one message keeps correct ordering (`unicode-bidi: plaintext` on the box). Forced on in Auto. |
| **Also message text** | Off (default) = chat box only. On = sent messages and transcript paragraphs follow the direction too. Forced on in Auto, because Auto that stopped at the box would leave every sent Arabic message reading left-to-right. |

`pre` / `code` / `kbd` / `samp` are pinned to LTR in RTL mode so code never scrambles.

### The composer is a rich-text editor, not a textarea

The GUI does not put the composer in a `textarea`. It binds **Lexical** to a
`contenteditable` host and Lexical writes one block element per line (`<p>`, and
`<li>` inside a list) as children of that host.

`unicode-bidi` does not inherit, and the property's own definition is explicit
that plaintext on a block box "will not affect any descendant blocks". A rule on
the host therefore never reaches a single character that is typed — measured:
with only the host rule, a paragraph inside the host stayed left-aligned while
the same paragraph matched by a `p` rule went right-to-left.

So the Auto (and smart) sheet names the host's block descendants as well:

```css
[contenteditable]:not([contenteditable="false"]) :where(p, div, li, …) { unicode-bidi: plaintext; }
```

This also makes the mode independent of the editor: Lexical happens to write
`dir="auto"` on its top-level blocks today, and the plugin must not depend on
that. `direction` is still never forced in Auto, so English reading order is
never touched.

### List markers in Auto

Auto decides the marker **per item**, from that item's own language:

| Item | Marker |
| --- | --- |
| Arabic (`نستكشف المشروع`) | right edge, next to the text |
| English (`Explore the project`) | left edge, next to the text |

This needs `list-style-position: inside`, and the reason is subtle.

`unicode-bidi: plaintext` on the `li` only changes how the item's **content** is
ordered — it derives the paragraph direction from the first strong character. It
does **not** change the element's `direction` property.

A `::marker` with `list-style-position: outside` lives in its own box beside the
item, and the side it takes is decided by that item's `direction` property.
Because `plaintext` never touches that property, an outside marker is stuck on
one fixed side — which is why the number stayed on the left for Arabic items no
matter what else was tried.

With `inside`, the marker becomes the first **inline** box of the item's own
content, so it is ordered by the same plaintext-derived paragraph direction as
the text. That is the only way to get a per-item marker side from CSS. Two
consequences of `inside` then have to be handled, and both were measured in
Chromium rather than reasoned about.

#### A block child strands the marker

Markdown emits `<li><p>…</p></li>` whenever a list is **loose** — a blank line
between items, which is common in replies. The marker is the item's first
*inline* box, so a block child leaves it alone on a line of its own: the item
measured 56px tall with its paragraph starting 32px down, i.e. the number drawn
above the text.

The GUI's own stylesheet already works around this for `ol` nested in a list
(`:where(ul,ol) ol li p { display: inline }`). Auto does it for every list:

```css
li > p:first-child { display: inline; unicode-bidi: normal !important }
```

`unicode-bidi: normal` is load-bearing, and leaving it out is a real trap: the
shared rule gives every `p` plaintext, which on an *inline* box becomes an
`FSI … PDI` isolate. UAX9 rule P2 ignores the characters inside an isolate while
looking for the paragraph's first strong character, so the item found no strong
character, fell back to LTR, and put the Arabic marker back on the left. Made
transparent to the bidi algorithm, the inlined paragraph's text is what the
item's own plaintext paragraph reads. Later paragraphs stay blocks, so
multi-paragraph items keep their breaks.

`!important` on that `unicode-bidi` is what carries it **into the composer**.
The rule above that gives the host's block descendants plaintext is scoped to
`[contenteditable]`, so it specificities at (0,2,0) — `[contenteditable]` plus
the `:not()` argument — while `li > p:first-child` reaches only (0,1,2). Without
the flag the composer's own plaintext wins, the isolate is back, and an Arabic
item's number returns to the left. Measured in Chromium, an Arabic `<li><p>`
inside a `contenteditable` host:

| Sheet | Left gap | Right gap | Marker |
| --- | --- | --- | --- |
| without `!important` | 20px | 319px | **left** |
| with `!important` | 319px | 20px | right |

Transcript text was never affected — nothing there outranks the rule — which is
what made the fault read as a marker bug rather than a cascade one. The flag is
a declaration-level win over a sibling rule of this same sheet, not another
override of the GUI's stylesheet.

#### A nested list needs its own step in

With every gutter zeroed (`padding-inline-*: 0`) a nested list lost its
indentation entirely — the child item's text landed on the parent's edge. The
marker cannot supply it either: inside markers have no gutter column. So the
inset comes from the nested block itself:

```css
li > ul, li > ol { padding-inline: 0.9em !important }
```

It is symmetric on purpose. One list holds Arabic and English items side by
side, and only an explicit `direction` could pick a side — which is exactly what
Auto does not have.

In **RTL** and **LTR** modes one direction is set for the whole list, so those
keep `outside` markers and the hanging indent — and neither of the two
workarounds above is emitted.

### Blockquote bars and task-list boxes

Two things depend on the item's `direction` property, which plaintext never
changes and one list cannot vary per item, so **Auto** leaves them at their
physical defaults:

- a `blockquote` keeps its bar on the left even when its Arabic text aligns right
  (the GUI's markdown sheet sets `border-left` / `padding-left` physically);
- a task-list `input[type=checkbox]` keeps the GUI's `margin: 0 8px 0 0`, so the
  gap sits on the checkbox's outer side for an Arabic item rather than between
  the box and its text.

**RTL** sets one direction for the whole surface, so it can — and does — mirror
both: the bar moves to the right (`border-right` + `padding-right`) and the
checkbox gap flips to the left (`margin: 0 0 0 8px`). **LTR** needs neither,
because the GUI is already left-to-right.


### Why the GUI's own list CSS must be overridden

The markdown stylesheet in `dsh-web-frontend` does this:

```css
._markdown_ :where(ul,ol)    { padding-left: 18px }
._markdown_ :where(ul,ol) ol { list-style-position: inside; padding-left: 0 }
```

`padding-left` is **physical**. In a right-to-left list the marker needs its
gutter on the *right*, so a left-only inset leaves the number with nowhere to go.

That selector — a class plus `:where()` — has specificity (0,1,0), so a plain
`ul, ol` rule loses to it. Every rule the plugin uses to correct list layout is
therefore marked `!important`.

The choice is stored in `localStorage` under `dsh-rtl-chat-box`, so it survives a
page reload.

## Layout

| Path | Role |
| --- | --- |
| `package.json` | Bundle manifest — `dsh.bundle.patch` and the `dsh.client` entry (`platform: web`). |
| `cordis.patch.yml` | Inserts the `ui-rtl-chat-box` row into the web plugin roster. |
| `lib/index.js` | Host loader entry. Deliberately a no-op: nothing host-side. |
| `lib/client.js` | The browser half — the direction stylesheet plus the General settings row. |
| `CHANGELOG.md` | Release history, starting at `0.1.0`. |
| `LICENSE` | MIT. |
| `.gitignore` | Node/JS ignores, plus the local `probe/` scratch space used when measuring layout. |

## Requirements

| Requirement | Version | Notes |
| --- | --- | --- |
| dsh | `0.1.5-rc.2` | The only release this plugin has been checked against. Declared per release in `dsh.compatibility.dshReleases`; other versions are unverified. |
| `@deepseek-ai/cordis` | `^4.0.1` | Peer dependency, resolved from the profile's own installation. |
| Profile | `web` | The plugin has a browser half and registers a `settings.general.item` slot. |
| Node.js | any version the installed dsh itself supports | The package is plain ESM with no build step, so it adds no Node version requirement of its own. |

`dsh-rtl-chat-box` has **no runtime npm dependencies**.
`lib/index.js` and `lib/client.js` ship prebuilt in the repository, so there is
no `prepare`/`build` step for pnpm to approve: installing straight from GitHub
does not need an `allowBuilds` entry in the profile's `pnpm-workspace.yaml`.

## Install

```sh
dsh plugin --profile web add "github:Mhmd7-7/dsh-rtl-chat-box"
```

To install a local checkout instead of the GitHub source, pass its path in place
of the spec:

```sh
dsh plugin --profile web add "C:\path\to\dsh-rtl-chat-box"
```

Then restart the web profile — the client bundle is built when the server
starts, so a running GUI will not pick this up until it restarts.

A restart really is required, and a page refresh is not enough: the host caches
each `/plugins/<id>/client.js` response with an immutable-cache header, keyed by
the content revision baked into `window.__DSH_BOOT__` — and that revision is
computed when the plugin graph is composed, which happens at server start. The
`client-hmr` row that would recompose on change is idle until a rebuild watcher
(`pnpm run dev:web` from a source checkout) rewrites bundles, so an edited
`lib/client.js` stays invisible to a server that started before the edit.

## Uninstall

```sh
dsh plugin --profile web remove dsh-rtl-chat-box
```

## Checking a change

The stylesheet is generated by `cssFor()`, so it can be rendered and measured
without the GUI. The probe that produced every number in this file loads the
plugin's own `lib/client.js` in Node (with `window`/`document` stubs), writes a
page per preference state next to a copy of the GUI's markdown stylesheet, and
reads geometry back from headless Chromium:

```sh
chrome --headless=new --dump-dom --virtual-time-budget=3000 file:///…/page.html
```

Per element it reports the text's ink gaps against the content box, which is
what distinguishes a marker on the right from one on the left, and `li` height
plus first-child offset, which is what catches a marker stranded on its own
line.

## Notes

The direction is applied through a single `<style>` element appended to
`document.head` and removed when the plugin's fiber is disposed.

The box is matched as `textarea` or a live `contenteditable` surface. Message
text — only when "also message text" is on — is scoped under the transcript
column, `[data-chat-flow]`, so the sidebar, settings, and every other surface
keep their normal layout. Direction is set on that container (it inherits)
rather than per paragraph, which is also what reaches the user-message bubble: a
plain `div` with no stable class of its own, so it could not be matched directly.
In Auto / smart modes that same bubble follows its own language via
`unicode-bidi: plaintext` on `div`.

## Permissions and scope

A dsh plugin runs with the permissions of the dsh process that loads it. This
one is a browser-side plugin, and what it touches is bounded:

| Surface | Access |
| --- | --- |
| Host files, network, child processes, credentials | **none** — `lib/index.js` exports an empty `apply()` and nothing else. |
| Browser DOM | appends one `<style>` element to `document.head`, removed when the plugin's fiber is disposed. |
| Browser storage | one `localStorage` key, `dsh-rtl-chat-box`, holding the direction preference. A blocked storage backend only costs persistence, never the live effect. |
| Settings UI | registers one row at `settings.general.item`. |

The package declares no file, network, command, or credential access and has no
runtime dependencies. It also has no `preinstall`, `install`, `postinstall`, or
`prepare` script — installing it runs nothing.

Being listed in a plugin catalogue is not a security review, so read the source:
the whole plugin is `lib/client.js` plus a no-op host entry.

## Contributing

Issues and pull requests are welcome at
<https://github.com/Mhmd7-7/dsh-rtl-chat-box>.

- Open an issue for a bug or a behaviour question. Include the direction mode
  (RTL / LTR / Auto), what you expected, and what the box did instead.
- Keep a pull request focused on one change. Please do **not** refactor the
  direction logic (`cssFor()` in `lib/client.js`) as a side effect: the comments
  there record why each rule is shaped the way it is, and most of those details
  were measured in Chromium rather than reasoned about.
- Any layout claim should arrive with the measurement that supports it, in the
  form described under [Checking a change](#checking-a-change).
- Add your entry to `CHANGELOG.md` under `## [Unreleased]`, and bump `version`
  in `package.json` if the release is part of the pull request.

## License

[MIT](LICENSE) © 2026 Mhmd7-7

