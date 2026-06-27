<script lang="ts">
	import type { PostPublication } from '$contracts/backend';
	import { PLATFORMS, PLATFORM_COUNT, type PlatformMeta } from '$lib/constants/platforms';

	interface Props {
		publications: PostPublication[];
		/** Click handler — parent typically opens PublicationManageSheet. */
		onOpenManage?: () => void;
	}

	let { publications, onOpenManage }: Props = $props();

	const publishedKeys = $derived(new Set(publications.map((p) => p.platform)));
	const publishedCount = $derived(publishedKeys.size);

	function isPublished(p: PlatformMeta): boolean {
		return publishedKeys.has(p.key);
	}
</script>

<button
	type="button"
	onclick={onOpenManage}
	aria-label="Quản lý trạng thái đã đăng"
	class="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs transition hover:border-slate-400 hover:bg-slate-50"
>
	<span class="font-medium text-slate-700">
		Đã đăng <span class="tabular-nums">{publishedCount}/{PLATFORM_COUNT}</span>
	</span>
	<span class="flex flex-1 flex-wrap items-center gap-1">
		{#each PLATFORMS as p (p.key)}
			{@const on = isPublished(p)}
			<span
				class="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] {on
					? p.tone
					: 'bg-slate-100 text-slate-400'}"
				title={on ? `Đã đăng ${p.label}` : `Chưa đăng ${p.label}`}
			>
				<span class={p.icon} aria-hidden="true"></span>
				<span class="hidden sm:inline">{p.label}</span>
			</span>
		{/each}
	</span>
	<span class="icon-[lucide--chevron-right] text-base text-slate-400" aria-hidden="true"></span>
</button>
