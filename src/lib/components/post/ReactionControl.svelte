<script lang="ts">
	import type { ReactionSummary, ReactionTargetType } from '$contracts/backend';
	import { ApiError } from '$lib/api/client';
	import { toggleReaction } from '$lib/api/reactions';

	interface Props {
		targetType: ReactionTargetType;
		targetID: string;
		summaries: ReactionSummary[];
		onChange?: (summaries: ReactionSummary[]) => void;
	}

	let { targetType, targetID, summaries, onChange }: Props = $props();

	const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

	let busy = $state(false);

	function summaryFor(emoji: string): ReactionSummary | undefined {
		return summaries.find((s) => s.emoji === emoji);
	}

	async function onToggle(emoji: string) {
		if (busy) return;
		busy = true;
		try {
			const result = await toggleReaction(targetType, targetID, emoji);
			onChange?.(result.summaries);
		} catch (err) {
			console.error(err instanceof ApiError ? err.message : err);
		} finally {
			busy = false;
		}
	}
</script>

<div class="flex flex-wrap items-center gap-1">
	{#each EMOJIS as emoji (emoji)}
		{@const s = summaryFor(emoji)}
		<button
			type="button"
			disabled={busy}
			onclick={() => onToggle(emoji)}
			aria-pressed={s?.reacted_by_me ?? false}
			class="flex items-center gap-1 rounded-full px-2 py-1 text-sm transition disabled:opacity-60 {s?.reacted_by_me
				? 'bg-slate-900 text-white'
				: 'bg-slate-100 text-slate-700 hover:bg-slate-200'}"
		>
			<span>{emoji}</span>
			{#if s && s.count > 0}
				<span class="text-xs">{s.count}</span>
			{/if}
		</button>
	{/each}
</div>
