<script lang="ts">
	import type { PublicationPlatform } from '$contracts/backend';
	import { PLATFORMS } from '$lib/constants/platforms';

	interface Props {
		/** Platforms to show only posts that have NOT been published there. */
		unpublishedOn: PublicationPlatform[];
		onChange: (next: PublicationPlatform[]) => void;
		compact?: boolean;
	}

	let { unpublishedOn, onChange, compact = false }: Props = $props();

	function isActive(p: PublicationPlatform): boolean {
		return unpublishedOn.includes(p);
	}

	function toggle(p: PublicationPlatform) {
		onChange(isActive(p) ? unpublishedOn.filter((k) => k !== p) : [...unpublishedOn, p]);
	}

	function clearAll() {
		onChange([]);
	}
</script>

<div class="space-y-2 rounded-2xl bg-white shadow-sm {compact ? 'p-2' : 'p-3'}">
	<div class="flex items-center justify-between">
		<div>
			<div class="text-xs font-medium text-slate-600">Chỉ hiện bài còn thiếu đăng ở</div>
			{#if !compact}
				<div class="text-[11px] text-slate-400">Chọn 1 hoặc nhiều nền tảng</div>
			{/if}
		</div>
		{#if unpublishedOn.length > 0}
			<button type="button" onclick={clearAll} class="text-xs text-slate-500 hover:text-slate-900">
				Bỏ lọc
			</button>
		{/if}
	</div>
	<div class="flex flex-wrap gap-1.5">
		{#each PLATFORMS as p (p.key)}
			{@const active = isActive(p.key)}
			<button
				type="button"
				onclick={() => toggle(p.key)}
				aria-pressed={active}
				class="inline-flex items-center gap-1 rounded-full text-xs font-medium transition {compact
					? 'px-2 py-0.75'
					: 'px-2.5 py-1'} {active
					? 'bg-slate-900 text-white'
					: 'bg-slate-100 text-slate-700 hover:bg-slate-200'}"
			>
				<span class={p.icon} aria-hidden="true"></span>
				{p.label}
			</button>
		{/each}
	</div>
</div>
