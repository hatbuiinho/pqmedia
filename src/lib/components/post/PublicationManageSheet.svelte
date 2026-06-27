<script lang="ts" module>
	import { platformLabel } from '$lib/constants/platforms';
	function platformLabelOf(p: string | undefined | null): string {
		return p ? platformLabel(p as never) : '';
	}
</script>

<script lang="ts">
	import type { PostPublication, PublicationPlatform } from '$contracts/backend';
	import { ApiError } from '$lib/api/client';
	import { deletePublication, upsertPublication } from '$lib/api/publications';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import { PLATFORMS } from '$lib/constants/platforms';
	import { clickOutside } from '$lib/utils/clickOutside';

	interface Props {
		open: boolean;
		postID: string;
		publications: PostPublication[];
		onClose: () => void;
		/** Called whenever the publication list changes (after a confirmed toggle). */
		onChange?: (publications: PostPublication[]) => void;
	}

	let { open, postID, publications, onClose, onChange }: Props = $props();

	let pending = $state<{ platform: PublicationPlatform; mark: boolean } | null>(null);
	let busy = $state(false);
	let error = $state<string | null>(null);

	function publicationFor(key: PublicationPlatform): PostPublication | undefined {
		return publications.find((p) => p.platform === key);
	}

	function requestToggle(platform: PublicationPlatform) {
		const mark = !publicationFor(platform);
		pending = { platform, mark };
	}

	function cancelToggle() {
		if (busy) return;
		pending = null;
	}

	async function confirmToggle() {
		if (!pending || busy) return;
		busy = true;
		error = null;
		try {
			const { platform, mark } = pending;
			if (mark) {
				const created = await upsertPublication(postID, platform);
				const next = [...publications.filter((p) => p.platform !== platform), created];
				onChange?.(next);
			} else {
				await deletePublication(postID, platform);
				onChange?.(publications.filter((p) => p.platform !== platform));
			}
			pending = null;
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Cập nhật thất bại';
		} finally {
			busy = false;
		}
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-40 grid items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center"
		role="presentation"
	>
		<div
			class="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl"
			role="dialog"
			aria-modal="true"
			aria-label="Quản lý trạng thái đã đăng"
			use:clickOutside={{ enabled: open, onDismiss: onClose }}
		>
			<header class="mb-3 flex items-start justify-between gap-3">
				<div>
					<h2 class="text-base font-semibold text-slate-900">Đã đăng ở đâu?</h2>
					<p class="mt-0.5 text-xs text-slate-500">
						Tick vào nền tảng bạn đã đăng để app khỏi nhắc đăng lại.
					</p>
				</div>
				<button
					type="button"
					onclick={onClose}
					aria-label="Đóng"
					class="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
				>
					<span class="icon-[lucide--x] text-base" aria-hidden="true"></span>
				</button>
			</header>

			<ul class="space-y-1">
				{#each PLATFORMS as p (p.key)}
					{@const pub = publicationFor(p.key)}
					{@const on = !!pub}
					<li>
						<button
							type="button"
							onclick={() => requestToggle(p.key)}
							disabled={busy}
							aria-pressed={on}
							class="flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition disabled:opacity-60 {on
								? 'border-emerald-200 bg-emerald-50 text-emerald-800'
								: 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'}"
						>
							<span class="{p.icon} text-base" aria-hidden="true"></span>
							<span class="flex-1">{p.label}</span>
							{#if on}
								<span class="icon-[lucide--check] text-base text-emerald-600" aria-hidden="true"
								></span>
							{:else}
								<span class="text-xs text-slate-400">Chưa đăng</span>
							{/if}
						</button>
					</li>
				{/each}
			</ul>

			{#if error}
				<p class="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
			{/if}
		</div>
	</div>
{/if}

<ConfirmDialog
	open={pending !== null}
	title={pending?.mark
		? `Đánh dấu đã đăng ${platformLabelOf(pending?.platform)}?`
		: `Bỏ đánh dấu đã đăng ${platformLabelOf(pending?.platform)}?`}
	message={pending?.mark
		? 'Sau khi đánh dấu, bài viết sẽ bị loại khỏi danh sách "chưa đăng" tại nền tảng này.'
		: 'Bài viết sẽ quay lại danh sách "chưa đăng" và có thể bị nhắc đăng tiếp.'}
	confirmText={pending?.mark ? 'Đã đăng' : 'Bỏ đánh dấu'}
	danger={!pending?.mark}
	{busy}
	onConfirm={confirmToggle}
	onCancel={cancelToggle}
/>
