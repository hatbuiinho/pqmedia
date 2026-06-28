<script lang="ts">
	import type { Post } from '$contracts/backend';
	import {
		canShareFiles,
		copyToClipboard,
		fetchImagesAsFiles,
		isShareSupported,
		shareNative
	} from '$lib/share/native-share';
	import ModalSurface from '$lib/components/ui/ModalSurface.svelte';
	import { platforms } from '$lib/stores/platforms.svelte';

	interface Props {
		open: boolean;
		post: Post;
		onClose: () => void;
		/** Fires after user completes a native share (not on cancel/copy). */
		onShared?: () => void;
	}

	let { open, post, onClose, onShared }: Props = $props();

	let busy = $state(false);
	let message = $state<string | null>(null);
	const supportsShare = $derived(isShareSupported());

	const imageCount = $derived(post.attachments.filter((a) => a.kind === 'image').length);
	const hasImages = $derived(imageCount > 0);
	const allPlatformsPublished = $derived(post.publications.length >= platforms.activeCount);

	function reset() {
		busy = false;
		message = null;
	}

	function close() {
		reset();
		onClose();
	}

	async function onShareWithImages() {
		if (busy) return;
		busy = true;
		message = 'Đang chuẩn bị ảnh…';
		try {
			const files = await fetchImagesAsFiles(post.attachments);
			if (files.length === 0 || !canShareFiles(files)) {
				// Browser blocked the file type or fetch failed — fall back to text-only.
				message = 'Không tải được ảnh, đang chia sẻ chỉ text…';
				await runShare({ text: post.content });
				return;
			}
			await runShare({ text: post.content, files });
		} finally {
			busy = false;
		}
	}

	async function onShareTextOnly() {
		if (busy) return;
		busy = true;
		await runShare({ text: post.content });
		busy = false;
	}

	async function runShare(payload: { text: string; files?: File[] }) {
		const outcome = await shareNative(payload);
		if (outcome === 'shared') {
			onShared?.();
			close();
		} else if (outcome === 'aborted') {
			reset();
		} else if (outcome === 'unsupported') {
			message = 'Trình duyệt không hỗ trợ chia sẻ. Hãy dùng "Sao chép nội dung".';
		} else {
			message = 'Chia sẻ thất bại. Thử "Sao chép nội dung".';
		}
	}

	async function onCopy() {
		if (busy) return;
		busy = true;
		const ok = await copyToClipboard(post.content);
		message = ok ? 'Đã sao chép nội dung vào clipboard.' : 'Không sao chép được.';
		busy = false;
	}
</script>

{#if open}
	<ModalSurface
		{open}
		label="Chia sẻ bài viết"
		onClose={close}
		containerClass="grid items-end justify-center sm:items-center"
		panelClass="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl"
	>
		<header class="mb-3 flex items-start justify-between gap-3">
			<div>
				<h2 class="text-base font-semibold text-slate-900">Chia sẻ bài viết</h2>
				<p class="mt-0.5 text-xs text-slate-500">Nội dung sẽ được điền sẵn trên app bạn chọn.</p>
			</div>
			<button
				type="button"
				onclick={close}
				aria-label="Đóng"
				class="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
			>
				<span class="icon-[lucide--x] text-base" aria-hidden="true"></span>
			</button>
		</header>

		{#if allPlatformsPublished}
			<p class="mb-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
				<span class="icon-[lucide--triangle-alert] mr-1 align-middle" aria-hidden="true"></span>
				Bài này đã được đánh dấu đăng đủ {platforms.activeCount} nền tảng. Vẫn tiếp tục?
			</p>
		{/if}

		<div class="space-y-2">
			{#if supportsShare}
				{#if hasImages}
					<button
						type="button"
						disabled={busy}
						onclick={onShareWithImages}
						class="flex w-full items-center gap-3 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
					>
						<span class="icon-[lucide--share-2] text-lg" aria-hidden="true"></span>
						<span class="flex-1 text-left">Chia sẻ kèm {imageCount} ảnh</span>
					</button>
				{/if}

				<button
					type="button"
					disabled={busy}
					onclick={onShareTextOnly}
					class="flex w-full items-center gap-3 rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
				>
					<span class="icon-[lucide--type] text-lg" aria-hidden="true"></span>
					<span class="flex-1 text-left">Chỉ chia sẻ text</span>
				</button>
			{/if}

			<button
				type="button"
				disabled={busy}
				onclick={onCopy}
				class="flex w-full items-center gap-3 rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
			>
				<span class="icon-[lucide--copy] text-lg" aria-hidden="true"></span>
				<span class="flex-1 text-left">Sao chép nội dung</span>
			</button>
		</div>

		{#if message}
			<p class="mt-3 rounded-md bg-slate-100 px-3 py-2 text-xs text-slate-600">{message}</p>
		{/if}

		{#if !supportsShare}
			<p class="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
				Trình duyệt này không hỗ trợ chia sẻ tới app khác. Hãy dùng "Sao chép nội dung".
			</p>
		{/if}
	</ModalSurface>
{/if}
