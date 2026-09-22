window.__ModuleLoader__.load({
	id: 'dsh-rtl-chat-box',
	factory: (require) => {
		var module = { exports: {} }
		var exports = module.exports
		Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

		let react = require('react')

		//#region state
		/** Durable preference key; the shape is validated on read, never trusted. */
		const STORAGE_KEY = 'dsh-rtl-chat-box'

		/** The chat box: a plain textarea or any live contenteditable surface. */
		const INPUT_SEL = 'textarea, [contenteditable]:not([contenteditable="false"])'

		/** The transcript column: the stable container that holds every message. */
		const CHAT_SEL = '[data-chat-flow]'

		/**
		 * The card the GUI renders for one `ask_user_question` request. It is mounted
		 * into the composer slot, so it is neither the transcript column nor the
		 * composer host and needs a scope of its own: the question and its answers
		 * have to follow the mode just as the chat does.
		 */
		const QUERY_SEL = '[data-question-key]'

		/**
		 * Body copy without `li`: list items own their marker handling. `div` is
		 * included because the user-message bubble is a plain `div` with no stable
		 * class of its own, so plaintext on `div` is what lets its language choose
		 * its own side in Auto / smart modes.
		 *
		 * `td`/`th` are deliberately absent: a cell is not a paragraph and must not
		 * choose a base direction of its own — that is what `CELL_SEL` is for.
		 */
		const BODY_SEL = 'div, p, blockquote, dd, dt, h1, h2, h3, h4, h5, h6, code'

		/**
		 * A table cell and the blocks a markdown cell may hold. Table direction is a
		 * property of the *table*, so every cell is forced to inherit it and to use
		 * plain `normal` bidi instead of `plaintext`.
		 *
		 * `code`/`pre` stay out on purpose: a code run keeps its own LTR isolation so
		 * it remains readable inside an RTL cell.
		 *
		 * No space after the commas inside `:where()`: `inChat`/`inBox` split a
		 * selector list on `, `, so a comma followed by a space would break them.
		 */
		const CELL_SEL = 'td, th, ' +
			'td :where(p,div,ul,ol,dl,blockquote,h1,h2,h3,h4,h5,h6), ' +
			'th :where(p,div,ul,ol,dl,blockquote,h1,h2,h3,h4,h5,h6)'

		/** Scope a comma selector list under the transcript column. */
		function inChat(sel) {
			return sel.split(', ').map((part) => CHAT_SEL + ' ' + part).join(', ')
		}

		/** Scope a comma selector list under the composer's contenteditable host. */
		function inBox(sel) {
			return sel.split(', ').map((part) => '[contenteditable]:not([contenteditable="false"]) ' + part).join(', ')
		}

		/** Scope a comma selector list under both the transcript and the composer. */
		function both(sel) {
			return inChat(sel) + ', ' + inBox(sel)
		}

		const MODES = [
			{ id: 'rtl', label: 'RTL', title: 'The chat box is right-to-left' },
			{ id: 'ltr', label: 'LTR', title: 'The chat box is left-to-right' },
			{ id: 'auto', label: 'Auto', title: 'The chat box follows the text you type' },
		]

		const MODE_IDS = MODES.map((mode) => mode.id)

		const DEFAULTS = { mode: 'rtl', smart: true, alsoText: false }

		/** Read the stored preference, falling back field by field on anything malformed. */
		function loadState() {
			let stored = null
			try {
				const raw = window.localStorage.getItem(STORAGE_KEY)
				stored = raw === null ? null : JSON.parse(raw)
			} catch (error) {
				stored = null
			}
			if (stored === null || typeof stored !== 'object') return Object.assign({}, DEFAULTS)
			return {
				mode: MODE_IDS.indexOf(stored.mode) === -1 ? DEFAULTS.mode : stored.mode,
				smart: typeof stored.smart === 'boolean' ? stored.smart : DEFAULTS.smart,
				alsoText: typeof stored.alsoText === 'boolean' ? stored.alsoText : DEFAULTS.alsoText,
			}
		}

		function saveState(state) {
			try {
				window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
			} catch (error) {
				// A blocked storage backend only costs persistence, never the live effect.
			}
		}

		/**
		 * The GUI's markdown CSS indents every list with a *physical* left padding:
		 *
		 *   ._markdown_ :where(ul,ol)    { padding-left: 18px }
		 *   ._markdown_ :where(ul,ol) ol { list-style-position: inside; padding-left: 0 }
		 *
		 * Its specificity is (0,1,0) — a class plus `:where()` — so plain `ul, ol`
		 * rules lose to it. Anything that must win is therefore `!important`.
		 */
		/** The chat box's own list gutter, reused for a list inside a question detail. */
		const LIST_PAD = 'padding-left: 0 !important; padding-right: 0 !important; ' +
			'padding-inline-start: 1.6em !important; padding-inline-end: 0 !important'

		/**
		 * The same gutter for a card list, at the length the GUI's markdown sheet
		 * already indents those lists with (`padding-left: 18px`). Written logically
		 * so a right-to-left card puts the marker's gutter on the right; in LTR it is
		 * the very value the sheet uses, so nothing moves.
		 */
		const QUERY_LIST_PAD = 'padding-left: 0 !important; padding-right: 0 !important; ' +
			'padding-inline-start: 18px !important; padding-inline-end: 0 !important'

		/**
		 * Only the chat box's own stylesheet is generated: the page root is never touched.
		 *
		 * ## Why Auto needs `list-style-position: inside`
		 *
		 * `unicode-bidi: plaintext` only changes how an element's *content* is
		 * ordered — it derives the paragraph direction from the first strong
		 * character. It does **not** change the element's `direction` property.
		 *
		 * A `::marker` with `list-style-position: outside` lives in its own box
		 * beside the item, and the side it takes is decided by the item's
		 * `direction` property. Since plaintext never touches that property, an
		 * outside marker can only ever sit on one fixed side — which is exactly why
		 * the number stayed on the left for Arabic items no matter what was tried.
		 *
		 * With `inside`, the marker becomes the first *inline* box of the item's own
		 * content, so it is ordered by the same plaintext-derived paragraph
		 * direction as the text: an Arabic item puts the number on the right, an
		 * English item on the left. That is the only way to get a per-item marker
		 * side from CSS, and it is why Auto uses `inside` while RTL/LTR — which set
		 * one direction for the whole list — keep the hanging indent with `outside`.
		 *
		 * Two consequences of `inside` are handled in the Auto branch below, and
		 * both were measured in Chromium: an item whose content starts with a block
		 * (`<li><p>…</p></li>`, i.e. a loose markdown list) strands the marker on its
		 * own line, and with every gutter zeroed a nested list loses its step in.
		 */
		function cssFor(state) {
			/**
			 * Auto governs message text as well as the box, whatever "also message
			 * text" says.
			 *
			 * Auto is the mode that follows whatever you type, and a reply in the
			 * transcript was typed too: box-only rules leave every sent Arabic
			 * message reading left-to-right with its list numbers on the left, which
			 * is precisely the complaint the mode was chosen to fix. RTL and LTR are
			 * the "force one direction" modes, and those still honour the checkbox.
			 */
			const withText = state.alsoText || state.mode === 'auto'
			const rules = []

			// The box itself: RTL and LTR force one direction on the composer.
			if (state.mode === 'rtl') rules.push(INPUT_SEL + ' { direction: rtl; text-align: right; }')
			if (state.mode === 'ltr') rules.push(INPUT_SEL + ' { direction: ltr; text-align: left; }')

			// Message text, only when "also message text" is on. `direction` is set
			// on the transcript container so it inherits to every descendant —
			// including the user-message bubble, which is a plain `div` with no
			// stable class of its own to match.
			if (withText && state.mode === 'rtl') rules.push(CHAT_SEL + ' { direction: rtl; text-align: right; }')
			if (withText && state.mode === 'ltr') rules.push(CHAT_SEL + ' { direction: ltr; text-align: left; }')

			// Auto and smart bidi: follow the text itself, per paragraph.
			if (state.mode === 'auto' || state.smart) {
				rules.push(INPUT_SEL + ' { unicode-bidi: plaintext; }')
				// `unicode-bidi` does not inherit, and the property is explicitly
				// documented to not reach descendant blocks: "setting plaintext on a
				// block box will not affect any descendant blocks". The composer is a
				// rich-text editor — the GUI binds Lexical to a contenteditable host
				// and Lexical writes one block element per line — so the host rule
				// above never touches a single character that is actually typed. Those
				// child blocks are the bidi paragraphs, so they are named here.
				//
				// `td`/`th` are missing from that list on purpose: a table cell is a
				// grid slot, not a paragraph, and letting each cell choose would split
				// one table across two directions (see CELL_SEL).
				rules.push('[contenteditable]:not([contenteditable="false"]) :where(' +
					'p, div, li, dd, dt, blockquote, pre, h1, h2, h3, h4, h5, h6, code' +
					') { unicode-bidi: plaintext; }')

				if (withText) rules.push(inChat(BODY_SEL) + ' { unicode-bidi: plaintext; }')
			}

			if (withText) {
				if (state.mode === 'rtl') {
					// Whole list mirrors: numbers move to the right edge with the text.
					// `direction` is set on the list *and* the items so the marker side
					// is unambiguous whichever one the engine consults.
					rules.push(inChat('ul, ol') + ' { direction: rtl; ' + LIST_PAD + '; list-style-position: outside !important; }')
					rules.push(inChat('li') + ' { direction: rtl; text-align: right; }')
					// `isolate` keeps the number from being reordered against the RTL run.
					rules.push(inChat('li::marker') + ' { unicode-bidi: isolate; }')
					// The GUI's markdown sheet draws the blockquote bar and the task-list
					// checkbox gap physically (border-left / padding-left and
					// `margin: 0 8px 0 0`). RTL sets one direction for the whole surface,
					// so both must be mirrored onto the right edge.
					rules.push(inChat('blockquote') +
						' { border-left: none !important; ' +
						'border-right: 2px solid var(--dsw-alias-label-caption, rgba(128,128,128,0.4)) !important; ' +
						'padding-left: 0 !important; padding-right: 14px !important; }')
					rules.push(inChat('input[type="checkbox"]') + ' { margin: 0 0 0 8px !important; }')
				}
				if (state.mode === 'auto') {
					// Per item: an Arabic item puts its number on the right with the
					// text, an English item keeps it on the left. (The `inside` rationale
					// and its two workarounds are in the cssFor doc comment.)
					rules.push(both('ul, ol') + ' { padding-left: 0 !important; padding-right: 0 !important; ' +
						'padding-inline-start: 0 !important; padding-inline-end: 0 !important; ' +
						'list-style-position: inside !important; }')
					rules.push(both('li > ul, li > ol') + ' { padding-inline: 0.9em !important; }')
					rules.push(both('li > p:first-child') + ' { display: inline; unicode-bidi: normal !important; }')
					rules.push(both('li') + ' { unicode-bidi: plaintext; text-align: start; }')
					// `isolate` — not `plaintext` — keeps the counter's own "1." glyph
					// order intact (LTR digits and period) while leaving the box's
					// position to the line's direction.
					rules.push(both('li::marker') + ' { unicode-bidi: isolate; }')
				}
			}

			// Code stays readable in a right-to-left box. The transcript is only
			// touched when "also message text" is on; the composer is always covered.
			if (state.mode === 'rtl') {
				const codeSel = withText ? both('pre, code, kbd, samp') : inBox('pre, code, kbd, samp')
				rules.push(codeSel + ' { direction: ltr; text-align: left; unicode-bidi: isolate !important; }')
			}

			// Tables: one direction for the whole grid, never one per cell.
			//
			// `unicode-bidi: normal !important` is the actual repair. A cell that
			// inherits `plaintext` derives a base direction from its *own* first
			// strong character, so in a table of Arabic cells one cell opening with a
			// Latin word (an identifier, a path, `RTL`, `v0.1.0`) flips to LTR, its
			// text jumps to the other edge and its mixed content reorders differently
			// from the column it belongs to. `normal` restores the inherited grid
			// direction and `direction: inherit` takes that direction from the table,
			// so the whole row can never disagree with itself.
			//
			// `text-align: start` (not `right`) keeps each cell aligned to *its own*
			// direction; a column the markdown renderer aligned carries an inline
			// `style="text-align:…"`, which still wins over this rule, and the GUI's
			// own `th { text-align: start }` no longer matters.
			const cells = withText ? both(CELL_SEL) : inBox(CELL_SEL)
			rules.push(cells + ' { direction: inherit; text-align: start; unicode-bidi: normal !important; }')

			// In the force modes the table direction is a constant, so it is written
			// here and the `dir` attribute the runtime pass may have left behind can
			// never override it. Auto has no constant to write — see the pass.
			const tables = withText ? both('table') : inBox('table')
			if (state.mode === 'rtl') rules.push(tables + ' { direction: rtl; }')
			if (state.mode === 'ltr') rules.push(tables + ' { direction: ltr; }')

			// The ask-question card: the question text and the answers offered under
			// it follow the mode, exactly like the composer — the card is where the
			// user reads a question and types an answer, so it is an input surface
			// and is forced rather than left to "also message text".
			//
			// One `direction` on the card is what turns the whole card around: the
			// header puts its actions on the other side, an option row lays its
			// number, label and description out from the other edge, and the footer
			// swaps its buttons — none of which a per-element `dir` could do, because
			// a flex row is placed by its own `direction`, not by its children's.
			if (state.mode === 'rtl') rules.push(QUERY_SEL + ' { direction: rtl; text-align: start; }')
			if (state.mode === 'ltr') rules.push(QUERY_SEL + ' { direction: ltr; text-align: start; }')

			// An empty answer field has no strong character to derive a direction from,
			// and `dir="auto"` falls back to LTR — which would left-align the card's own
			// Arabic placeholder. While the placeholder is showing, the field takes the
			// card's direction instead; from the first typed character the pass's
			// `dir="auto"` is in charge again, so an English answer still reads LTR.
			rules.push(QUERY_SEL + ' textarea:placeholder-shown { direction: inherit; }')

			// A card list keeps its indent but gains it on the marker's own side. The
			// GUI's sheet indents a card list physically, so a card that is (or turns)
			// right-to-left would draw its marker outside the indent it has and, on a
			// scrolling body, a horizontal scrollbar with it (measured: 4px).
			rules.push(QUERY_SEL + ' :where(ul, ol) { ' + QUERY_LIST_PAD + ' }')

			return rules.join('\n')
		}

		let current = loadState()
		let styleEl = null

		/** Commit one preference change to the live stylesheet and to storage. */
		function commit(next) {
			current = next
			saveState(next)
			if (styleEl !== null) styleEl.textContent = cssFor(next)
			// A mode change also changes which tables and which auto-directed
			// elements the runtime passes govern.
			syncTableDirs()
			syncAutoPass()
		}
		//#endregion

		//#region table direction
		/**
		 * ## Why Auto needs a runtime pass for tables
		 *
		 * Every other element here is a paragraph, and a paragraph is allowed to pick
		 * its own base direction — that is what `unicode-bidi: plaintext` hands it. A
		 * table is not: its direction decides both the order of the inline runs inside
		 * every cell and the left-to-right order of the columns themselves, so it must
		 * be one value for the whole grid.
		 *
		 * The stylesheet settles the cells (`CELL_SEL`) and the force modes, which
		 * leaves Auto — where the direction has to come from the table's own text.
		 * CSS cannot do that for a table: `plaintext` is a per-paragraph property and
		 * a table box has no paragraph of its own, so the pass below writes `dir` on
		 * the table and every cell inherits it.
		 */
		const DIR_MARK = 'data-dsh-table-dir'

		/** Strong right-to-left characters: the Arabic and Hebrew blocks, plus RLM. */
		const RTL_CHAR = /[\u0590-\u08FF\u200F\uFB1D-\uFDFF\uFE70-\uFEFF]/

		/** Inside those blocks, the characters the bidi algorithm still calls weak. */
		const WEAK_CHAR = /[\u0600-\u0605\u0660-\u0669\u06DD\u06F0-\u06F9\u08E2]/

		/** Strong left-to-right characters: Latin, Greek, Cyrillic, CJK, plus LRM. */
		const LTR_CHAR = /[A-Za-z\u00C0-\u058F\u0900-\u1FFF\u200E\u2C00-\uD7FF\uF900-\uFB17\uFF21-\uFF3A\uFF41-\uFF5A]/

		/**
		 * The direction of the first strong character in `text`, or null when it holds
		 * none — empty, digits, punctuation, emoji. A table with no strong character
		 * is better off inheriting than being handed a direction it never asked for.
		 *
		 * The weak check runs first because the Arabic-Indic digits sit inside the
		 * RTL ranges but are not strong: a table opening with "١٢٣" must not be
		 * pushed right-to-left by a character the bidi algorithm itself ignores.
		 */
		function firstStrong(text) {
			for (const ch of text) {
				if (WEAK_CHAR.test(ch)) continue
				if (RTL_CHAR.test(ch)) return 'rtl'
				if (LTR_CHAR.test(ch)) return 'ltr'
			}
			return null
		}

		/** Which surfaces a "follow the text" mode governs right now. */
		function tableScopes() {
			return {
				// Smart bidi reaches the composer only; Auto reaches both.
				box: current.mode === 'auto' || current.smart,
				chat: current.mode === 'auto',
			}
		}

		/** Drop a direction this plugin wrote, leaving the table to inherit again. */
		function clearTableDir(table) {
			if (!table.hasAttribute(DIR_MARK)) return
			table.removeAttribute(DIR_MARK)
			table.removeAttribute('dir')
		}

		/** Give a table the direction of its own first strong character. */
		function setTableDir(table) {
			const dir = firstStrong(table.textContent || '')
			if (dir === null) {
				clearTableDir(table)
				return
			}
			table.setAttribute(DIR_MARK, dir)
			if (table.getAttribute('dir') !== dir) table.setAttribute('dir', dir)
		}

		/** One pass over every table that is, or was, under this plugin's direction. */
		function syncTableDirs() {
			const scope = tableScopes()
			const tables = new Set(document.querySelectorAll('[' + DIR_MARK + ']'))
			if (scope.chat) for (const table of document.querySelectorAll(CHAT_SEL + ' table')) tables.add(table)
			if (scope.box) for (const table of document.querySelectorAll(INPUT_SEL + ' table')) tables.add(table)

			for (const table of tables) {
				const inScope = (scope.chat && table.closest(CHAT_SEL) !== null) ||
					(scope.box && table.closest(INPUT_SEL) !== null)
				if (inScope) setTableDir(table)
				else clearTableDir(table)
			}
		}

		let tableFrame = 0

		/** Streaming rewrites the transcript constantly; one pass per frame is plenty. */
		function scheduleTableSync() {
			if (tableFrame !== 0) return
			tableFrame = window.requestAnimationFrame(() => {
				tableFrame = 0
				syncTableDirs()
			})
		}

		/**
		 * Cheap pre-filter for the observer: the app mutates the document for every
		 * streamed token and every tool result, and only a mutation that touches a
		 * table can change a table's direction.
		 */
		function touchesTable(records) {
			for (const record of records) {
				const target = record.target
				if (target.nodeType === 1) {
					if (target.tagName === 'TABLE' || target.querySelector('table') !== null) return true
				} else if (target.parentElement !== null && target.parentElement.closest('table') !== null) {
					// A text node being rewritten inside a cell.
					return true
				}
				for (const added of record.addedNodes) {
					if (added.nodeType === 1 && (added.tagName === 'TABLE' || added.querySelector('table') !== null)) return true
				}
			}
			return false
		}
		//#endregion

		//#region auto direction pass
		/**
		 * ## Why Auto needs a runtime pass
		 *
		 * Two kinds of surface cannot take their direction from CSS, for the same
		 * reason: the direction has to come from each element's own text.
		 *
		 * ### List items
		 *
		 * The Auto sheet already gives every `li` `unicode-bidi: plaintext`, which
		 * derives the paragraph direction from the item's own first strong
		 * character. That is enough for the text — but not for the marker. A
		 * `::marker` box is placed by the element's `direction` property, and
		 * `plaintext` never changes that property: it reorders the item's content
		 * and nothing else. `list-style-position: inside` moves the marker into the
		 * item's own content, so it is ordered by the same paragraph direction as
		 * the text, yet the side it lands on is still `direction` — which is why an
		 * Arabic item kept its number stuck on the left.
		 *
		 * ### The ask-question card
		 *
		 * The card the GUI renders for `ask_user_question` is mounted into the
		 * composer slot, so it is neither the transcript column nor the composer
		 * host: no rule of this sheet reaches it. Its answer field is a plain
		 * `textarea` that React owns, and its title, detail, option labels and
		 * descriptions are ordinary text-carrying elements, so in Auto they would
		 * keep the page's inherited direction — an Arabic question would read
		 * left-to-right while the transcript next to it reads right-to-left.
		 *
		 * Both cases are fixed the same way. No CSS selector can read an element's
		 * text and set a property from it, so the per-element direction has to be
		 * written from script. `dir="auto"` is exactly that computation performed
		 * by the engine: it derives `direction` from the element's own first strong
		 * character, and re-derives it whenever the content changes — which is what
		 * finally moves the marker to the item's own side, and what turns an Arabic
		 * answer field right-to-left. It is an HTML attribute, not a style, so it is
		 * the only route to a per-element `direction`.
		 *
		 * The pass is deliberately narrow:
		 *
		 * - **Auto only.** RTL and LTR write one direction for the whole surface in
		 *   the stylesheet, so nothing here may touch them.
		 * - **Only elements with no `dir` of their own.** The composer is Lexical and
		 *   Lexical writes `dir` on its blocks itself; an element that already
		 *   carries one is the editor's business, not the plugin's.
		 * - **The card, then the text inside it.** The card element itself is marked
		 *   so its own direction turns the whole card around; inside it, an element
		 *   is marked when it is the answer field, or a block a text run may live in,
		 *   or an element with a text node of its own. List items are left to inherit
		 *   the card, so their markers keep the gutter the sheet gives them.
		 * - **Marked.** Every attribute this pass writes carries `AUTO_DIR_MARK`, so
		 *   leaving Auto hands back those and only those, never an editor's `dir`.
		 */
		const AUTO_DIR_MARK = 'data-dsh-auto-dir'

		/** The card's free-text answer field: a textarea, or any contenteditable. */
		const QUERY_FIELD_SEL = 'textarea, [contenteditable]:not([contenteditable="false"])'

		/**
		 * The blocks a card text run may live in. Named by tag on top of the
		 * "carries text" test because a block whose text sits in inline children
		 * (`<p>نص <strong>مهم</strong></p>`) has no text node of its own.
		 *
		 * `li` is deliberately absent: see the list-item carve-out in the pass.
		 */
		const QUERY_TEXT_SEL = 'p, dd, dt, blockquote, pre, code, h1, h2, h3, h4, h5, h6, td, th'

		/** Every list item the pass governs: the transcript column and the composer host. */
		const AUTO_ITEM_SEL = both('li')

		/** True only in the one mode this pass exists for. */
		function autoScopeOn() {
			return current.mode === 'auto'
		}

		/** Write `dir` on an element that has none of its own, and mark it as ours. */
		function setAutoDir(el) {
			if (el.hasAttribute('dir')) return
			el.setAttribute(AUTO_DIR_MARK, 'auto')
			el.setAttribute('dir', 'auto')
		}

		/**
		 * Hand an element back. The recorded value is the value that gets removed, so
		 * a `dir` some other code set in the meantime survives, and a card written
		 * `rtl` is handed back just as cleanly as an item written `auto`.
		 */
		function clearAutoDir(el) {
			const written = el.getAttribute(AUTO_DIR_MARK)
			if (written === null) return
			el.removeAttribute(AUTO_DIR_MARK)
			if (el.getAttribute('dir') === written) el.removeAttribute('dir')
		}

		/**
		 * Give a card the direction of its own first strong character.
		 *
		 * `dir="auto"` is deliberately *not* used for the card itself. The card's
		 * texts take `dir="auto"` of their own, and an element with a directionality
		 * of its own is an isolate: UAX9 rule P2 skips the characters inside an
		 * isolate while a paragraph looks for its first strong character. A card
		 * whose every text is isolated therefore has no strong character left to
		 * read, and falls back to LTR — measured: with `dir="auto"` on the card the
		 * card stayed left-to-right (and a field inside it stopped following the
		 * value typed into it), while the same card with an explicit `dir="rtl"`
		 * mirrored. So the direction is computed here, exactly as the table pass
		 * computes it, and re-read whenever the card's text changes.
		 */
		function setCardDir(card) {
			const dir = firstStrong(card.textContent || '')
			if (dir === null) {
				clearAutoDir(card)
				return
			}
			card.setAttribute(AUTO_DIR_MARK, dir)
			if (card.getAttribute('dir') !== dir) card.setAttribute('dir', dir)
		}

		/**
		 * Does this element carry text of its own, rather than only child elements?
		 * This is what keeps the card's flex rows — which hold nothing but spans,
		 * icons and the answer field — out of the pass, so no row ever mirrors.
		 */
		function carriesText(el) {
			for (const node of el.childNodes) {
				if (node.nodeType === 3 && node.textContent.trim() !== '') return true
			}
			return false
		}

		/** One pass over everything currently under this plugin's direction. */
		function syncAutoDirs() {
			if (!autoScopeOn()) return
			for (const el of document.querySelectorAll(AUTO_ITEM_SEL)) setAutoDir(el)
			// The question card. The card *itself* first: one direction computed from
			// its own text is what mirrors the whole card — title, option rows, footer.
			// Every element inside that carries text of its own then takes *its*
			// direction, so an English option in an Arabic question still reads
			// left-to-right.
			//
			// List items are carved out of the per-element pass: they inherit the card
			// direction and keep the GUI's markdown layout, whose gutter the sheet
			// above has already put on the marker's own side. Giving an item a
			// direction of its own would move its marker off that gutter (measured:
			// 4px of horizontal overflow on the card body).
			for (const card of document.querySelectorAll(QUERY_SEL)) {
				setCardDir(card)
				for (const el of card.querySelectorAll(QUERY_FIELD_SEL + ', ' + QUERY_TEXT_SEL)) {
					if (el.closest('li') !== null) continue
					setAutoDir(el)
				}
				for (const el of card.querySelectorAll('*')) {
					if (el.closest('li') === null && carriesText(el)) setAutoDir(el)
				}
			}
		}

		let autoObserver = null
		let autoFrame = 0

		/**
		 * Cheap pre-filter for the observer: streaming rewrites the transcript for
		 * every token, Lexical rewrites the composer on every keystroke, and the
		 * question card re-renders on every answer — but only a mutation that
		 * introduces an element this pass has not seen, or rewrites text inside a
		 * card (whose own direction is read from that text), can change anything.
		 * A text update anywhere else needs no pass: `dir="auto"` is re-derived by
		 * the engine when the content changes.
		 */
		function touchesAuto(records) {
			for (const record of records) {
				const target = record.target
				if (target.nodeType === 1) {
					// Text rewritten inside a card: the card's own direction is read
					// from that text. A text change anywhere else needs no pass.
					if (target.closest(QUERY_SEL) !== null) return true
					if (target.querySelector('li, ' + QUERY_SEL) !== null) return true
				} else if (target.parentElement !== null && target.parentElement.closest(QUERY_SEL) !== null) {
					return true
				}
				for (const added of record.addedNodes) {
					if (added.nodeType !== 1) continue
					if (added.tagName === 'LI' || added.closest(QUERY_SEL) !== null) return true
					if (added.querySelector('li, ' + QUERY_SEL) !== null) return true
				}
			}
			return false
		}

		/** Streaming rewrites the transcript constantly; one pass per frame is plenty. */
		function scheduleAutoSync() {
			if (autoFrame !== 0) return
			autoFrame = window.requestAnimationFrame(() => {
				autoFrame = 0
				syncAutoDirs()
			})
		}

		/** Mark everything in scope and watch for the elements the app adds later. */
		function startAutoPass() {
			if (autoObserver === null) {
				autoObserver = new MutationObserver((records) => {
					if (touchesAuto(records)) scheduleAutoSync()
				})
				if (document.body !== null) {
					// Attributes are not observed: this pass writes `dir` and its own
					// mark, and watching them would only feed its own output back in.
					// Text is observed because a card's own direction is read from it.
					autoObserver.observe(document.body, { childList: true, subtree: true, characterData: true })
				}
			}
			syncAutoDirs()
		}

		/** Stop watching and remove every `dir` this pass wrote. */
		function stopAutoPass() {
			if (autoObserver !== null) {
				autoObserver.disconnect()
				autoObserver = null
			}
			if (autoFrame !== 0) {
				window.cancelAnimationFrame(autoFrame)
				autoFrame = 0
			}
			for (const el of document.querySelectorAll('[' + AUTO_DIR_MARK + ']')) clearAutoDir(el)
		}

		/** Follow the mode: the pass lives exactly as long as Auto is selected. */
		function syncAutoPass() {
			if (autoScopeOn()) startAutoPass()
			else stopAutoPass()
		}
		//#endregion

		//#region settings row
		const labelColor = 'var(--dsw-alias-label-primary, inherit)'
		const subColor = 'var(--dsw-alias-label-secondary, inherit)'
		const borderColor = 'var(--dsw-alias-border-l2, rgba(128,128,128,0.4))'

		/**
		 * Active/inactive segments: the design system's own filled-control pair.
		 *
		 * "brand-primary" is a *foreground* token here — it resolves to near-black
		 * in light theme and to near-white in dark — so it must never be used as a
		 * fill with hardcoded white text. `button-primary-fill` with
		 * `label-primary-foreground` is the matching contrast pair the product's
		 * own buttons use, so the label stays legible in either theme.
		 */
		function buttonStyle(active) {
			return {
				padding: '3px 10px',
				borderRadius: '6px',
				fontSize: '12px',
				lineHeight: '18px',
				font: 'inherit',
				cursor: 'pointer',
				border: '1px solid ' + (active ? 'transparent' : borderColor),
				background: active ? 'var(--dsw-alias-button-primary-fill, #0f1115)' : 'transparent',
				color: active ? 'var(--dsw-alias-label-primary-foreground, #ffffff)' : labelColor,
			}
		}

		function checkboxRowStyle() {
			return { display: 'flex', gap: '6px', alignItems: 'center', fontSize: '12px', color: subColor, cursor: 'pointer' }
		}

		/** One compact General preference row: direction, smart bidi, and scope. */
		function DirectionRow() {
			const [state, setState] = react.useState(current)

			function update(patch) {
				const next = Object.assign({}, state, patch)
				setState(next)
				commit(next)
			}

			return react.createElement(
				'div',
				{ style: { display: 'flex', flexDirection: 'column', gap: '6px', padding: '10px 2px' } },
				react.createElement(
					'div',
					{ style: { display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', justifyContent: 'space-between' } },
					react.createElement(
						'div',
						{ style: { fontSize: '13px', color: labelColor } },
						'Chat box direction',
					),
					react.createElement(
						'div',
						{ style: { display: 'flex', gap: '6px', alignItems: 'center' } },
						MODES.map((mode) => react.createElement(
							'button',
							{
								key: mode.id,
								type: 'button',
								title: mode.title,
								style: buttonStyle(state.mode === mode.id),
								onClick: () => update({ mode: mode.id }),
							},
							mode.label,
						)),
					),
				),
				react.createElement(
					'div',
					{ style: { display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' } },
					react.createElement(
						'label',
						{ style: checkboxRowStyle() },
						react.createElement('input', {
							type: 'checkbox',
							checked: state.mode === 'auto' ? true : state.smart,
							disabled: state.mode === 'auto',
							onChange: (event) => update({ smart: event.target.checked }),
						}),
						'Smart bidi',
					),
					react.createElement(
						'label',
						{ style: checkboxRowStyle() },
						react.createElement('input', {
							type: 'checkbox',
							// Auto reads message text too, so the control is shown as the
							// on-and-locked state it already is — exactly like Smart bidi.
							checked: state.mode === 'auto' ? true : state.alsoText,
							disabled: state.mode === 'auto',
							onChange: (event) => update({ alsoText: event.target.checked }),
						}),
						'Also message text',
					),
				),
			)
		}
		//#endregion

		//#region plugin
		const inject = ['slots']

		function apply(ctx) {
			styleEl = document.createElement('style')
			styleEl.setAttribute('data-dsh-plugin', 'rtl-chat-box')
			styleEl.textContent = cssFor(current)
			document.head.appendChild(styleEl)

			// The pass only ever writes a marker it owns, so a table whose content
			// changes under it is re-read, and a table that leaves the governed
			// scopes (mode switch) gets its `dir` handed back.
			const observer = new MutationObserver((records) => {
				if (touchesTable(records)) scheduleTableSync()
			})
			if (document.body !== null) {
				observer.observe(document.body, { childList: true, subtree: true, characterData: true })
			}
			syncTableDirs()
			// Auto may already be the stored preference, in which case the pass
			// starts here and not on the first settings click.
			syncAutoPass()

			ctx.effect(() => () => {
				observer.disconnect()
				if (tableFrame !== 0) {
					window.cancelAnimationFrame(tableFrame)
					tableFrame = 0
				}
				for (const table of document.querySelectorAll('[' + DIR_MARK + ']')) clearTableDir(table)
				// The auto pass owns a second observer and a second set of `dir`
				// attributes; both go away with the fiber.
				stopAutoPass()
				if (styleEl !== null && styleEl.parentNode !== null) styleEl.parentNode.removeChild(styleEl)
				styleEl = null
			}, 'ui-rtl-chat-box: direction stylesheet')

			ctx.slots.inject('settings.general.item', () => ctx.slots.register({
				name: 'settings.general.item',
				id: 'rtl-chat-box',
				order: 21,
			}, DirectionRow))
		}

		exports.apply = apply
		exports.inject = inject
		return module.exports
	},
})
