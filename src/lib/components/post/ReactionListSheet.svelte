<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import type { ReactionTargetType } from '$contracts/backend';
	import { getReactionDetails, type ReactionDetail } from '$lib/api/reactions';
	import { clickOutside } from '$lib/utils/clickOutside';

	interface Props {
		open: boolean;
		targetType: ReactionTargetType;
		targetID: string;
		close: () => void;
	}

	let { open, targetType, targetID, close }: Props = $props();

	let loading = $state(false);
	let error = $state<string | null>(null);
	let items = $state<ReactionDetail[]>([]);

	$effect(() => {
		if (open && targetType && targetID) {
			loadData();
		}
	});

	async function loadData() {
		loading = true;
		error = null;
		try {
			const res = await getReactionDetails(targetType, targetID);
			items = res.details || [];
		} catch (err) {
			error = err instanceof Error ? err.message : 'Không thể tải danh sách';
		} finally {
			loading = false;
		}
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
		role="presentation"
		transition:fade={{ duration: 200 }}
		onpointerdown={close}
		onclick={close}
	></div>

	<aside
		aria-hidden={!open}
		class="fixed inset-x-0 bottom-0 z-[51] md:inset-x-auto md:right-auto md:left-1/2 md:-translate-x-1/2 md:bottom-auto md:top-1/2 md:-translate-y-1/2 md:w-[28rem]"
		transition:fly={{ y: 50, duration: 300, opacity: 0 }}
	>
		<div
			class="grid h-[60vh] grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-t-3xl bg-white shadow-2xl transition-transform duration-200 md:h-auto md:max-h-[min(40rem,calc(100dvh-2rem))] md:rounded-2xl"
			use:clickOutside={{ enabled: open, onDismiss: close }}
		>
			<div class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
				<h2 class="text-lg font-bold text-slate-800">Người đã bày tỏ cảm xúc</h2>
				<button
					class="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition"
					onclick={close}
					aria-label="Đóng"
				>
					<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			</div>

			<div class="overflow-y-auto p-2 overscroll-contain">
				{#if loading}
					<div class="py-10 text-center text-sm text-slate-500">Đang tải...</div>
				{:else if error}
					<div class="py-10 text-center text-sm text-rose-500">{error}</div>
				{:else if items.length === 0}
					<div class="py-10 text-center text-sm text-slate-500">Chưa có ai bày tỏ cảm xúc.</div>
				{:else}
					<div class="flex flex-col">
						{#each items as item (item.user_id + ':' + item.emoji)}
							<div
								class="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition cursor-default"
							>
								{#if item.avatar_url}
									<img
										src={item.avatar_url}
										alt={item.full_name}
										class="size-11 shrink-0 rounded-full object-cover border border-slate-100"
									/>
								{:else}
									<div
										class="grid size-11 shrink-0 place-items-center rounded-full bg-indigo-50 font-bold text-indigo-600 border border-indigo-100"
										aria-hidden="true"
									>
										{item.full_name.slice(0, 1)}
									</div>
								{/if}
								<div class="min-w-0 flex-1">
									<p class="truncate font-semibold text-slate-800">
										{item.full_name}
									</p>
									{#if item.count > 1}
										<p class="text-xs text-slate-500">Đã thả {item.count} lần</p>
									{/if}
								</div>
								<div
									class="shrink-0 text-2xl flex items-center justify-center size-10 bg-slate-50 rounded-full"
								>
									{item.emoji}
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</aside>
{/if}
