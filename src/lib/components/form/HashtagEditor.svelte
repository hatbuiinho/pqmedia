<script lang="ts">
	import { tick } from 'svelte';
	import { apiFetch } from '$lib/api/client';

	let {
		value = $bindable(''),
		placeholder = '',
		disabled = false,
		autofocus = false,
		editorClass = ''
	} = $props<{
		value?: string;
		placeholder?: string;
		disabled?: boolean;
		autofocus?: boolean;
		editorClass?: string;
	}>();

	let editorEl = $state<HTMLDivElement | null>(null);
	let rootEl = $state<HTMLDivElement | null>(null);

	let activeQuery = $state('');
	let mentionRange = $state<{ start: number; end: number } | null>(null);
	let menuOpen = $state(false);
	let candidates = $state<string[]>([]);
	let menuStyle = $state('');
	let isPopoverAbove = $state(false);
	let requestID = 0;

	// Keep track of plain text value internally
	let internalValue = $state('');

	$effect(() => {
		if (value !== internalValue) {
			internalValue = value;
			if (editorEl && editorEl.innerText !== value) {
				// Direct DOM write needed: the editor is contenteditable, so Svelte
				// doesn't reconcile innerText for us. Safe because we own the node.
				// eslint-disable-next-line svelte/no-dom-manipulating
				editorEl.innerText = value;
			}
		}
	});

	$effect(() => {
		if (autofocus && editorEl) {
			editorEl.focus();
		}
	});

	function getCaretIndex(element: HTMLElement): number {
		let position = 0;
		const isSupported = typeof window.getSelection !== 'undefined';
		if (isSupported) {
			const selection = window.getSelection();
			if (selection && selection.rangeCount !== 0) {
				const range = window.getSelection()!.getRangeAt(0);
				const preCaretRange = range.cloneRange();
				preCaretRange.selectNodeContents(element);
				preCaretRange.setEnd(range.endContainer, range.endOffset);
				position = preCaretRange.toString().length;
			}
		}
		return position;
	}

	function setCaretIndex(element: HTMLElement, position: number) {
		const selection = window.getSelection();
		if (!selection) return;

		let currentPos = 0;
		let found = false;

		function traverseNodes(node: Node) {
			if (found) return;

			if (node.nodeType === Node.TEXT_NODE) {
				const length = node.textContent?.length || 0;
				if (currentPos + length >= position) {
					const range = document.createRange();
					range.setStart(node, position - currentPos);
					range.collapse(true);
					selection!.removeAllRanges();
					selection!.addRange(range);
					found = true;
				} else {
					currentPos += length;
				}
			} else {
				for (const child of Array.from(node.childNodes)) {
					traverseNodes(child);
				}
			}
		}

		traverseNodes(element);
		if (!found) {
			const range = document.createRange();
			range.selectNodeContents(element);
			range.collapse(false);
			selection.removeAllRanges();
			selection.addRange(range);
		}
	}

	function updateHashtagState() {
		if (!editorEl) return;

		const caretPos = getCaretIndex(editorEl);
		const text = editorEl.innerText || '';

		// Find word under cursor. E.g. "Hello #world " -> match "#world" if cursor is inside or at the end
		const textBeforeCaret = text.slice(0, caretPos);

		// Match hashtag pattern: starts with #, then letters/numbers/underscores
		// We only want to trigger if we are actively typing a hashtag
		const match = textBeforeCaret.match(/(?:^|\s)(#[\p{L}\d_]*)$/u);

		if (match) {
			const query = match[1].slice(1); // remove '#'
			const startPos = caretPos - match[1].length;
			mentionRange = { start: startPos, end: caretPos };
			activeQuery = query;
			menuOpen = true;
		} else {
			mentionRange = null;
			activeQuery = '';
			menuOpen = false;
		}
	}

	function handleInput() {
		if (!editorEl) return;
		const text = editorEl.innerText || '';
		internalValue = text;
		value = text;
		updateHashtagState();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (disabled) return;

		if (event.key === 'Enter' && !event.shiftKey) {
			if (menuOpen) {
				event.preventDefault(); // allow selection via keyboard later if we want
				// For now just close it or let it type if not handled
			}
		}
	}

	function selectMention(hashtag: string) {
		if (!mentionRange || !editorEl) return;

		const text = editorEl.innerText || '';

		// Replace the range with the new hashtag and a trailing space
		const newHashtag = `#${hashtag} `;
		const textBeforeRange = text.slice(0, mentionRange.start);
		const isAtStartOrSpace = textBeforeRange.match(/(?:^|\s)$/);

		const replaced =
			textBeforeRange + (isAtStartOrSpace ? '' : ' ') + newHashtag + text.slice(mentionRange.end);

		value = replaced;
		internalValue = replaced;
		// Direct DOM write: contenteditable element bypasses Svelte reconciliation.
		// eslint-disable-next-line svelte/no-dom-manipulating
		editorEl.innerText = replaced;

		const nextCaretPos = mentionRange.start + (isAtStartOrSpace ? 0 : 1) + newHashtag.length;

		menuOpen = false;
		mentionRange = null;

		tick().then(() => {
			if (editorEl) {
				editorEl.focus();
				setCaretIndex(editorEl, nextCaretPos);
			}
		});
	}

	function updateMenuPosition() {
		if (!rootEl || !menuOpen || !editorEl) {
			menuStyle = '';
			return;
		}

		const selection = window.getSelection();
		if (!selection || selection.rangeCount === 0) return;

		const range = selection.getRangeAt(0);
		const rects = range.getClientRects();
		let targetRect = rects.length > 0 ? rects[0] : editorEl.getBoundingClientRect();

		const viewportWidth = window.innerWidth;
		const viewportHeight = window.innerHeight;
		const horizontalMargin = 12;
		const verticalGap = 8;

		const width = Math.min(220, viewportWidth - horizontalMargin * 2);
		const left = Math.max(
			horizontalMargin,
			Math.min(targetRect.left, viewportWidth - width - horizontalMargin)
		);
		const maxHeight = Math.min(192, viewportHeight - 24);

		const spaceBelow = viewportHeight - targetRect.bottom;
		const shouldPlaceAbove = spaceBelow < maxHeight + verticalGap && targetRect.top > 220;
		isPopoverAbove = shouldPlaceAbove;

		if (shouldPlaceAbove) {
			const bottom = viewportHeight - targetRect.top + verticalGap;
			menuStyle = `position:fixed;left:${left}px;bottom:${bottom}px;width:${width}px;max-height:${maxHeight}px;`;
		} else {
			const top = Math.min(viewportHeight - maxHeight - 12, targetRect.bottom + verticalGap);
			menuStyle = `position:fixed;left:${left}px;top:${top}px;width:${width}px;max-height:${maxHeight}px;`;
		}
	}

	$effect(() => {
		if (!menuOpen) {
			candidates = [];
			menuStyle = '';
			return;
		}

		updateMenuPosition();
		const currentRequestID = ++requestID;

		apiFetch<string[]>('/hashtags', { query: { q: activeQuery } })
			.then((items) => {
				if (currentRequestID !== requestID) return;
				candidates = items || [];

				// Add the exact typed word if it's not empty and not in the list
				if (activeQuery.trim() && !candidates.includes(activeQuery.trim())) {
					candidates = [activeQuery.trim(), ...candidates];
				}
			})
			.catch(() => {
				// ignore
			});
	});

	$effect(() => {
		if (!menuOpen) return;
		const update = () => updateMenuPosition();
		window.addEventListener('resize', update);
		window.addEventListener('scroll', update, true);
		return () => {
			window.removeEventListener('resize', update);
			window.removeEventListener('scroll', update, true);
		};
	});
</script>

<div bind:this={rootEl} class="relative w-full">
	<div
		bind:this={editorEl}
		class={`min-h-32 w-full overflow-y-auto overscroll-contain rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm leading-6 text-slate-800 focus:border-slate-500 focus:ring-1 focus:ring-slate-500 focus:outline-none whitespace-pre-wrap ${editorClass}`}
		contenteditable={!disabled}
		role="textbox"
		tabindex={disabled ? -1 : 0}
		aria-multiline="true"
		oninput={handleInput}
		onkeyup={updateHashtagState}
		onclick={updateHashtagState}
		onkeydown={handleKeydown}
	></div>

	{#if !value}
		<div
			class="pointer-events-none absolute top-2 right-3 left-3 text-sm text-slate-400"
			aria-hidden="true"
		>
			{placeholder}
		</div>
	{/if}

	{#if menuOpen && candidates.length > 0}
		<div
			class="z-[120] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
			style={menuStyle}
		>
			<div class="scrollbar-hidden max-h-48 overflow-y-auto p-1.5">
				<div class={`flex gap-1 ${isPopoverAbove ? 'flex-col-reverse' : 'flex-col'}`}>
					{#each candidates as candidate (candidate)}
						<button
							class="grid rounded-lg px-3 py-2 text-left transition hover:bg-slate-100"
							type="button"
							onmousedown={(event) => {
								event.preventDefault(); // keep focus on editor
							}}
							onclick={() => selectMention(candidate)}
						>
							<span class="text-sm font-medium text-slate-900">#{candidate}</span>
						</button>
					{/each}
				</div>
			</div>
		</div>
	{/if}
</div>
