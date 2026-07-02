<script lang="ts">
	import type { PublicationPlatform } from '$contracts/backend';
	import LucideIcon from '$lib/components/ui/LucideIcon.svelte';
	import { platforms } from '$lib/stores/platforms.svelte';
	import { clickOutside } from '$lib/utils/clickOutside';

	export type PublicationFilterState = 'published' | 'missing';

	interface Props {
		publicationFilters: Record<PublicationPlatform, PublicationFilterState>;
		onChange: (next: Record<PublicationPlatform, PublicationFilterState>) => void;
		compact?: boolean;
	}

	let { publicationFilters, onChange, compact = false }: Props = $props();
	let openMenuKey = $state<PublicationPlatform | null>(null);

	function filterStateOf(platform: PublicationPlatform): PublicationFilterState | null {
		return publicationFilters[platform] ?? null;
	}

	function setFilter(platform: PublicationPlatform, state: PublicationFilterState | null) {
		const next = { ...publicationFilters };
		if (state) {
			next[platform] = state;
		} else {
			delete next[platform];
		}
		onChange(next);
		openMenuKey = null;
	}

	function clearAll() {
		onChange({});
		openMenuKey = null;
	}

	function labelOf(state: PublicationFilterState | null): string {
		if (state === 'published') return 'Đã đăng';
		if (state === 'missing') return 'Chưa đăng';
		return 'Không lọc';
	}

	function pillClass(platform: PublicationPlatform, state: PublicationFilterState | null): string {
		if (!state) return 'bg-slate-100 text-slate-700 hover:bg-slate-200';
		return platforms.metaOf(platform)?.tone ?? 'bg-slate-100 text-slate-700';
	}
</script>

<div class="space-y-2 rounded-2xl bg-white shadow-sm {compact ? 'p-2' : 'p-3'}">
	<div class="flex items-center justify-between">
		<div>
			<div class="text-xs font-medium text-slate-600">Lọc theo trạng thái đăng nền tảng</div>
			{#if !compact}
				<div class="text-[11px] text-slate-400">
					Mỗi nền tảng có thể chọn: Không lọc, Đã đăng, Chưa đăng
				</div>
			{/if}
		</div>
		{#if Object.keys(publicationFilters).length > 0}
			<button type="button" onclick={clearAll} class="text-xs text-slate-500 hover:text-slate-900">
				Bỏ lọc
			</button>
		{/if}
	</div>
	<div class="flex flex-wrap gap-1.5">
		{#each platforms.activeItems as p (p.key)}
			{@const state = filterStateOf(p.key)}
			<div
				class="relative"
				use:clickOutside={{ enabled: openMenuKey === p.key, onDismiss: () => (openMenuKey = null) }}
			>
				<button
					type="button"
					onclick={() => (openMenuKey = openMenuKey === p.key ? null : p.key)}
					aria-haspopup="menu"
					aria-expanded={openMenuKey === p.key}
					aria-pressed={state !== null}
					class="inline-flex items-center gap-1 rounded-full text-xs font-medium transition {compact
						? 'px-2 py-0.75'
						: 'px-2.5 py-1'} {pillClass(p.key, state)}"
				>
					<LucideIcon icon={p.icon} className="size-3.5" />
					<span>{p.label}</span>
					{#if state}
						<span
							class="rounded-full bg-black/10 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-current"
						>
							{labelOf(state)}
						</span>
					{/if}
					<span class="icon-[lucide--chevron-down] size-3.5 opacity-70" aria-hidden="true"></span>
				</button>

				{#if openMenuKey === p.key}
					<div
						role="menu"
						aria-label={`Bộ lọc ${p.label}`}
						class="absolute top-[calc(100%+0.35rem)] left-0 z-20 w-36 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
					>
						<button
							type="button"
							role="menuitemradio"
							aria-checked={state === null}
							onclick={() => setFilter(p.key, null)}
							class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
						>
							<span class="icon-[lucide--circle-off] text-base text-slate-400" aria-hidden="true"
							></span>
							Không lọc
						</button>
						<button
							type="button"
							role="menuitemradio"
							aria-checked={state === 'published'}
							onclick={() => setFilter(p.key, 'published')}
							class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
						>
							<span
								class="icon-[lucide--check-check] text-base text-[var(--app-primary-strong)]"
								aria-hidden="true"
							></span>
							Đã đăng
						</button>
						<button
							type="button"
							role="menuitemradio"
							aria-checked={state === 'missing'}
							onclick={() => setFilter(p.key, 'missing')}
							class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
						>
							<span
								class="icon-[lucide--clock-arrow-up] text-base text-slate-500"
								aria-hidden="true"
							></span>
							Chưa đăng
						</button>
					</div>
				{/if}
			</div>
		{/each}
	</div>
</div>
