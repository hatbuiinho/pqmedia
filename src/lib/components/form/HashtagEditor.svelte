<script lang="ts">
	import { apiFetch } from '$lib/api/client';
	import { findActiveHashtag } from '$lib/utils/hashtags';

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

	let editorEl = $state<HTMLTextAreaElement | null>(null);
	let rootEl = $state<HTMLDivElement | null>(null);

	let activeQuery = $state('');
	let mentionRange = $state<{ start: number; end: number } | null>(null);
	let menuOpen = $state(false);
	let candidates = $state<string[]>([]);
	let menuStyle = $state('');
	let isPopoverAbove = $state(false);
	let highlightIndex = $state(0);
	let requestID = 0;

	$effect(() => {
		if (autofocus && editorEl) {
			editorEl.focus();
		}
	});

	function getTextBeforeCaret(element: HTMLTextAreaElement): string {
		return element.value.slice(0, element.selectionStart);
	}

	function setCaretIndex(element: HTMLTextAreaElement, position: number) {
		element.setSelectionRange(position, position);
	}

	function updateHashtagState() {
		if (!editorEl) return;

		const textBeforeCaret = getTextBeforeCaret(editorEl);
		const activeHashtag = findActiveHashtag(textBeforeCaret);

		if (activeHashtag) {
			mentionRange = { start: activeHashtag.start, end: activeHashtag.end };
			activeQuery = activeHashtag.query;
			menuOpen = true;
		} else {
			mentionRange = null;
			activeQuery = '';
			menuOpen = false;
		}
	}

	function handleInput() {
		if (!editorEl) return;
		value = editorEl.value;
		updateHashtagState();
	}

	function handleClick() {
		updateHashtagState();
	}

	function handleKeyup() {
		updateHashtagState();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (disabled) return;
		if (!menuOpen || candidates.length === 0) return;

		switch (event.key) {
			case 'Enter':
			case 'Tab': {
				if (event.key === 'Enter' && event.shiftKey) return;
				event.preventDefault();
				const idx = Math.min(Math.max(highlightIndex, 0), candidates.length - 1);
				selectMention(candidates[idx]);
				return;
			}
			case 'ArrowDown':
				event.preventDefault();
				highlightIndex = (highlightIndex + 1) % candidates.length;
				return;
			case 'ArrowUp':
				event.preventDefault();
				highlightIndex = (highlightIndex - 1 + candidates.length) % candidates.length;
				return;
			case 'Escape':
				event.preventDefault();
				menuOpen = false;
				mentionRange = null;
				return;
		}
	}

	function selectMention(hashtag: string) {
		if (!mentionRange || !editorEl) return;

		const newHashtag = `#${hashtag} `;
		const replaced =
			editorEl.value.slice(0, mentionRange.start) +
			newHashtag +
			editorEl.value.slice(mentionRange.end);

		value = replaced;
		editorEl.value = replaced;

		const nextCaretPos = mentionRange.start + newHashtag.length;

		menuOpen = false;
		mentionRange = null;

		editorEl.focus();
		setCaretIndex(editorEl, nextCaretPos);
	}

	function updateMenuPosition() {
		if (!rootEl || !menuOpen || !editorEl) {
			menuStyle = '';
			return;
		}

		const rootRect = rootEl.getBoundingClientRect();
		const width = Math.min(220, window.innerWidth - 24);
		const left = Math.max(12, Math.min(rootRect.left, window.innerWidth - width - 12));
		const spaceBelow = window.innerHeight - rootRect.bottom;
		const shouldPlaceAbove = spaceBelow < 220 && rootRect.top > 220;
		isPopoverAbove = shouldPlaceAbove;

		if (shouldPlaceAbove) {
			const bottom = window.innerHeight - rootRect.top + 8;
			menuStyle = `position:fixed;left:${left}px;bottom:${bottom}px;width:${width}px;max-height:192px;`;
		} else {
			const top = Math.min(window.innerHeight - 204, rootRect.bottom + 8);
			menuStyle = `position:fixed;left:${left}px;top:${top}px;width:${width}px;max-height:192px;`;
		}
	}

	$effect(() => {
		if (!menuOpen) {
			candidates = [];
			menuStyle = '';
			highlightIndex = 0;
			return;
		}

		updateMenuPosition();
		const currentRequestID = ++requestID;

		apiFetch<string[]>('/hashtags', { query: { q: activeQuery } })
			.then((items) => {
				if (currentRequestID !== requestID) return;
				candidates = items || [];
				if (activeQuery.trim() && !candidates.includes(activeQuery.trim())) {
					candidates = [activeQuery.trim(), ...candidates];
				}
				highlightIndex = 0;
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
	<textarea
		bind:this={editorEl}
		bind:value
		rows="5"
		class={`min-h-32 w-full resize-y overflow-y-auto overscroll-contain rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm leading-6 text-slate-800 whitespace-pre-wrap focus:border-slate-500 focus:ring-1 focus:ring-slate-500 focus:outline-none ${editorClass}`}
		{placeholder}
		{disabled}
		oninput={handleInput}
		onkeyup={handleKeyup}
		onclick={handleClick}
		onkeydown={handleKeydown}></textarea>

	{#if menuOpen && candidates.length > 0}
		<div
			class="z-[120] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
			style={menuStyle}
		>
			<div class="scrollbar-hidden max-h-48 overflow-y-auto p-1.5">
				<div class={`flex gap-1 ${isPopoverAbove ? 'flex-col-reverse' : 'flex-col'}`}>
					{#each candidates as candidate, idx (candidate)}
						{@const active = idx === highlightIndex}
						<button
							class="grid rounded-lg px-3 py-2 text-left transition {active
								? 'bg-slate-900 text-white'
								: 'text-slate-900 hover:bg-slate-100'}"
							type="button"
							onmousedown={(event) => {
								event.preventDefault();
							}}
							onmouseenter={() => (highlightIndex = idx)}
							onclick={() => selectMention(candidate)}
						>
							<span class="text-sm font-medium">#{candidate}</span>
						</button>
					{/each}
				</div>
			</div>
		</div>
	{/if}
</div>
