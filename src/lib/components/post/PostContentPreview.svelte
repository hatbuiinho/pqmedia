<script lang="ts">
	import { onMount } from 'svelte';

	interface Props {
		content: string;
		collapsedLines?: number;
	}

	let { content, collapsedLines = 6 }: Props = $props();

	let expanded = $state(false);
	let contentEl = $state<HTMLParagraphElement | null>(null);
	let overflowing = $state(false);
	let previousContent = $state('');

	function updateOverflowState() {
		if (!contentEl) return;
		overflowing = contentEl.scrollHeight > contentEl.clientHeight + 1;
	}

	$effect(() => {
		if (content !== previousContent) {
			previousContent = content;
			expanded = false;
		}
		queueMicrotask(updateOverflowState);
	});

	onMount(() => {
		updateOverflowState();
		const observer = new ResizeObserver(() => updateOverflowState());
		if (contentEl) observer.observe(contentEl);
		return () => observer.disconnect();
	});
</script>

<div class="space-y-1.5">
	<p
		bind:this={contentEl}
		class="whitespace-pre-wrap break-words text-sm text-slate-800"
		style={!expanded
			? `display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:${collapsedLines};overflow:hidden;`
			: undefined}
	>
		{content}
	</p>

	{#if overflowing || expanded}
		<button
			type="button"
			class="text-xs font-medium text-[var(--app-primary-strong)] transition hover:text-[var(--app-primary)]"
			onclick={() => {
				expanded = !expanded;
				queueMicrotask(updateOverflowState);
			}}
		>
			{expanded ? 'Thu gọn' : 'Xem thêm'}
		</button>
	{/if}
</div>
