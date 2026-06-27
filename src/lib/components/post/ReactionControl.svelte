<script lang="ts">
	import { untrack } from 'svelte';
	import type { ReactionSummary, ReactionTargetType } from '$contracts/backend';
	import { ApiError } from '$lib/api/client';
	import { toggleReaction } from '$lib/api/reactions';
	import ReactionListSheet from './ReactionListSheet.svelte';

	interface Props {
		targetType: ReactionTargetType;
		targetID: string;
		summaries: ReactionSummary[];
		onChange?: (summaries: ReactionSummary[]) => void;
		variant?: 'inline' | 'comment-float';
	}

	let { targetType, targetID, summaries, onChange, variant = 'inline' }: Props = $props();

	const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

	let busy = $state(false);

	let listOpen = $state(false);
	let pickerOpen = $state(false);
	let isLongPress = $state(false);
	let pressTimer = $state<ReturnType<typeof setTimeout> | null>(null);

	let localSummaries = $state<ReactionSummary[]>([]);
	let pendingEmoji = $state<string | null>(null);
	let pendingDelta = $state<number>(0);
	let debounceTimer = $state<ReturnType<typeof setTimeout> | null>(null);

	let particles = $state<{ id: number; emoji: string; x: number; y: number; drift: number }[]>([]);
	let particleId = 0;
	let wrapperEl = $state<HTMLElement | null>(null);

	let hoverTimer = $state<ReturnType<typeof setTimeout> | null>(null);

	$effect(() => {
		const current = summaries || [];
		untrack(() => {
			if (!busy && pendingEmoji === null) {
				localSummaries = current;
			}
		});
	});

	let activeReaction = $derived(localSummaries.find((r) => r.reacted_by_me));
	let currentActionEmoji = $derived(activeReaction?.emoji || '❤️');
	let displayEmoji = $derived(activeReaction?.emoji || '');

	function handleReaction(emoji: string, e?: MouseEvent) {
		if (e && wrapperEl && emoji !== '') {
			const id = particleId++;
			const drift = Math.floor(Math.random() * 60) - 30; // -30px to 30px
			const rect = wrapperEl.getBoundingClientRect();
			const localX = e.clientX - rect.left;
			const localY = e.clientY - rect.top;
			particles.push({ id, emoji, x: localX, y: localY, drift });
			setTimeout(() => {
				particles = particles.filter((p) => p.id !== id);
			}, 1000);
		}

		let current = localSummaries.map((r) => ({ ...r }));
		let existingMyReaction = current.find((r) => r.reacted_by_me);

		if (existingMyReaction && existingMyReaction.emoji !== emoji) {
			existingMyReaction.count -= 1;
			existingMyReaction.reacted_by_me = false;
			pendingDelta = 0; // Reset delta when changing emoji
		}

		let target = current.find((r) => r.emoji === emoji);
		if (emoji !== '') {
			if (target) {
				target.count += 1;
				target.reacted_by_me = true;
			} else {
				current.push({ emoji, count: 1, reacted_by_me: true });
			}
			pendingDelta += 1;
		} else {
			pendingDelta = 0;
		}

		localSummaries = current.filter((r) => r.count > 0);
		pendingEmoji = emoji;
		pickerOpen = false;

		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			const delta = pendingDelta;
			pendingDelta = 0;
			void submitReaction(emoji, delta);
		}, 500);
	}

	async function submitReaction(emoji: string, delta: number) {
		busy = true;
		try {
			const result = await toggleReaction(targetType, targetID, emoji, delta);
			onChange?.(result.summaries);
		} catch (err) {
			console.error(err instanceof ApiError ? err.message : err);
			localSummaries = summaries || [];
		} finally {
			busy = false;
			pendingEmoji = null;
		}
	}
</script>

<svelte:window
	onclick={() => {
		if (pickerOpen) pickerOpen = false;
	}}
/>

<div
	bind:this={wrapperEl}
	class="flex items-center gap-1.5 {variant === 'comment-float'
		? 'absolute right-3 bottom-0 z-[1] translate-y-1/2'
		: ''}"
	onpointerdown={(e) => e.stopPropagation()}
	onclick={(e) => e.stopPropagation()}
	role="none"
>
	<div
		class="flex items-center gap-1.5 overflow-x-auto scrollbar-hidden {variant === 'comment-float'
			? 'max-w-[calc(100vw-8rem)]'
			: ''}"
	>
		{#if localSummaries.length > 0}
			{#each localSummaries as s (s.emoji)}
				<button
					class={`inline-flex items-center gap-1 cursor-pointer rounded-full px-2 py-1 text-xs font-semibold ${s.reacted_by_me ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
					type="button"
					onclick={(e) => {
						e.stopPropagation();
						listOpen = true;
					}}
				>
					<span>{s.emoji}</span>
					<span>{s.count}</span>
				</button>
			{/each}
		{/if}
	</div>

	<div
		class="relative flex items-center"
		role="none"
		onpointerenter={(e) => {
			if (e.pointerType === 'mouse') {
				if (hoverTimer) clearTimeout(hoverTimer);
				hoverTimer = setTimeout(() => {
					pickerOpen = true;
				}, 200);
			}
		}}
		onpointerleave={(e) => {
			if (e.pointerType === 'mouse') {
				if (hoverTimer) clearTimeout(hoverTimer);
				hoverTimer = setTimeout(() => {
					pickerOpen = false;
				}, 300);
			}
		}}
	>
		<button
			class={`inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border transition ${pickerOpen ? 'bg-slate-100 border-slate-300' : 'border-slate-200 bg-white hover:border-indigo-300 text-slate-400 hover:text-indigo-500'}`}
			type="button"
			aria-label="Thả cảm xúc"
			onpointerdown={(e) => {
				if (e.button !== 0) return;
				e.stopPropagation();
				if (e.pointerType !== 'mouse') {
					isLongPress = false;
					pressTimer = setTimeout(() => {
						isLongPress = true;
						pickerOpen = true;
					}, 400);
				}
			}}
			onpointerup={() => {
				if (pressTimer) {
					clearTimeout(pressTimer);
					pressTimer = null;
				}
			}}
			onpointerleave={() => {
				if (pressTimer) {
					clearTimeout(pressTimer);
					pressTimer = null;
				}
			}}
			onclick={(e) => {
				e.stopPropagation();
				if (!isLongPress) {
					handleReaction(currentActionEmoji, e);
				}
				isLongPress = false;
			}}
		>
			{#if displayEmoji}
				<span class="text-[1.125rem] leading-none pointer-events-none translate-y-px"
					>{displayEmoji}</span
				>
			{:else}
				<span class="icon-[lucide--heart] size-4" aria-hidden="true"></span>
			{/if}
		</button>

		{#if pickerOpen}
			<div
				class="animate-in fade-in zoom-in-95 duration-200 absolute right-0 bottom-full z-[2] mb-2 flex origin-bottom-right gap-1 rounded-full border border-slate-200 bg-white p-1.5 shadow-xl"
			>
				{#each EMOJIS as emoji, index (emoji)}
					<button
						class="icon-pop flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-xl transition hover:bg-slate-100 hover:scale-110"
						style="animation-delay: {index * 30}ms;"
						type="button"
						onclick={(e) => handleReaction(emoji, e)}
					>
						{emoji}
					</button>
				{/each}

				{#if activeReaction}
					<div class="w-px bg-slate-200 mx-0.5 my-1"></div>
					<button
						class="icon-pop flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-xl transition hover:bg-rose-50 text-rose-400 hover:text-rose-500 hover:scale-110"
						style="animation-delay: {EMOJIS.length * 30}ms;"
						type="button"
						aria-label="Xoá cảm xúc"
						onclick={(e) => handleReaction('', e)}
					>
						<span class="icon-[lucide--x] size-5" aria-hidden="true"></span>
					</button>
				{/if}
			</div>
		{/if}
	</div>

	{#each particles as p (p.id)}
		<div
			class="absolute z-[2] pointer-events-none text-3xl particle-fly"
			style="left: {p.x}px; top: {p.y}px; --drift: {p.drift}px;"
		>
			{p.emoji}
		</div>
	{/each}
</div>

<ReactionListSheet open={listOpen} {targetType} {targetID} close={() => (listOpen = false)} />

<style>
	@keyframes flyUpFixed {
		0% {
			opacity: 0;
			transform: translate(-50%, -50%) scale(0.5);
		}
		20% {
			opacity: 1;
			transform: translate(calc(-50% + var(--drift) * 0.2), calc(-50% - 30px)) scale(1.5);
		}
		100% {
			opacity: 0;
			transform: translate(calc(-50% + var(--drift)), calc(-50% - 150px)) scale(1);
		}
	}
	.particle-fly {
		animation: flyUpFixed 1s cubic-bezier(0.25, 1, 0.5, 1) forwards;
	}
	@keyframes popIn {
		0% {
			opacity: 0;
			transform: scale(0.5);
		}
		60% {
			opacity: 1;
			transform: scale(1.2);
		}
		100% {
			opacity: 1;
			transform: scale(1);
		}
	}
	.icon-pop {
		opacity: 0;
		animation: popIn 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
	}
</style>
