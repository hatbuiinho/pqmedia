<script lang="ts">
	import type { PostPublication, PublicationPlatform } from '$contracts/backend';
	import { ApiError } from '$lib/api/client';
	import { deletePublication, upsertPublication } from '$lib/api/publications';
	import { platforms } from '$lib/stores/platforms.svelte';

	interface Props {
		postID: string;
		publications: PostPublication[];
		onChange?: (publications: PostPublication[]) => void;
	}

	let { postID, publications, onChange }: Props = $props();

	let busy = $state<PublicationPlatform | null>(null);
	let editing = $state<PublicationPlatform | null>(null);
	let urlDraft = $state('');
	let error = $state<string | null>(null);

	function isOn(platform: PublicationPlatform): boolean {
		return publications.some((p) => p.platform === platform);
	}

	function urlOf(platform: PublicationPlatform): string {
		return publications.find((p) => p.platform === platform)?.external_url ?? '';
	}

	async function toggle(platform: PublicationPlatform) {
		if (busy) return;
		busy = platform;
		error = null;
		try {
			let next: PostPublication[];
			if (isOn(platform)) {
				await deletePublication(postID, platform);
				next = publications.filter((p) => p.platform !== platform);
			} else {
				const created = await upsertPublication(postID, platform);
				next = [...publications, created];
			}
			onChange?.(next);
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Cập nhật thất bại';
		} finally {
			busy = null;
		}
	}

	function startEdit(platform: PublicationPlatform) {
		editing = platform;
		urlDraft = urlOf(platform);
	}

	async function saveUrl(platform: PublicationPlatform) {
		if (busy) return;
		busy = platform;
		error = null;
		try {
			const created = await upsertPublication(postID, platform, {
				external_url: urlDraft.trim() || null
			});
			const next = isOn(platform)
				? publications.map((p) => (p.platform === platform ? created : p))
				: [...publications, created];
			onChange?.(next);
			editing = null;
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Lưu thất bại';
		} finally {
			busy = null;
		}
	}
</script>

<div class="space-y-2">
	<div class="flex flex-wrap gap-1">
		{#each platforms.itemsForPublications(publications) as p (p.key)}
			{@const on = isOn(p.key)}
			<button
				type="button"
				disabled={busy !== null}
				onclick={() => toggle(p.key)}
				ondblclick={() => startEdit(p.key)}
				aria-pressed={on}
				class="rounded-full px-2.5 py-1 text-xs transition disabled:opacity-60 {on
					? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
					: 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
				title="Click: bật/tắt · Đúp click: nhập URL"
			>
				{on ? '✓ ' : ''}{p.label}
			</button>
		{/each}
	</div>

	{#if editing}
		<div class="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
			<input
				type="url"
				placeholder="https://… (link bài đã đăng)"
				bind:value={urlDraft}
				class="flex-1 rounded-md border-slate-300 text-xs focus:border-slate-500 focus:ring-slate-500"
			/>
			<button
				type="button"
				class="rounded-md bg-slate-900 px-2 py-1 text-xs text-white hover:bg-slate-800"
				onclick={() => editing && saveUrl(editing)}
				disabled={busy !== null}
			>
				Lưu
			</button>
			<button
				type="button"
				class="text-xs text-slate-500 hover:text-slate-700"
				onclick={() => (editing = null)}
			>
				Huỷ
			</button>
		</div>
	{/if}

	{#if error}
		<p class="text-xs text-rose-600">{error}</p>
	{/if}
</div>
