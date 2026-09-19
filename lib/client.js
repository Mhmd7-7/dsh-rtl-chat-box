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
		 * Body copy without `li`: list items own their marker handling. `div` is
		 * included because the user-message bubble is a plain `div` with no stable
		 * class of its own, so plaintext on `div` is what lets its language choose
		 * its own side in Auto / smart modes.
		 */
		const BODY_SEL = 'div, p, blockquote, dd, dt, td, th, h1, h2, h3, h4, h5, h6, code'

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
		const LIST_PAD = 'padding-left: 0 !important; padding-right: 0 !important; ' +
			'padding-inline-start: 1.6em !important; padding-inline-end: 0 !important'

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
				rules.push('[contenteditable]:not([contenteditable="false"]) :where(' +
					'p, div, li, dd, dt, blockquote, pre, td, th, h1, h2, h3, h4, h5, h6, code' +
					') { unicode-bidi: plaintext; }')
				//rules.push('[contenteditable]:not([contenteditable="false"]) :where(table) { direction: inherit; }')
				
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
			return rules.join('\n')
		}

		let current = loadState()
		let styleEl = null

		/** Commit one preference change to the live stylesheet and to storage. */
		function commit(next) {
			current = next
			saveState(next)
			if (styleEl !== null) styleEl.textContent = cssFor(next)
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

			ctx.effect(() => () => {
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
