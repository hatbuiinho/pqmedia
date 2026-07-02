<script lang="ts">
	import type { PostPublication, PublicationPlatform } from '$contracts/backend';
	import { ApiError } from '$lib/api/client';
	import { upsertPublication } from '$lib/api/publications';
	import { canManagePublications } from '$lib/auth/access';
	import LucideIcon from '$lib/components/ui/LucideIcon.svelte';
	import ModalSurface from '$lib/components/ui/ModalSurface.svelte';
	import { auth } from '$lib/stores/auth.svelte';
	import { platforms } from '$lib/stores/platforms.svelte';
	import { buttonStyles } from '$lib/styles/buttons';
	import { selectionStyles } from '$lib/styles/selection';

	interface Props {
		open: boolean;
		postID: string;
		currentPublications: PostPublication[];
		onClose: () => void;
		onSaved?: (publications: PostPublication[]) => void;
	}

	let { open, postID, currentPublications, onClose, onSaved }: Props = $props();

	// Plain array beats Set/Map: avoids svelte/prefer-svelte-reactivity warnings
	// and the selection list is short, so includes() is fine.
	let selected = $state<PublicationPlatform[]>([]);
	let saving = $state(false);
	let error = $state<string | null>(null);
	const canManage = $derived(canManagePublications(auth.principal));

	// Reset selection each time the dialog opens — auto-tick the platforms that
	// have not been marked yet so user just confirms ("đăng đủ" is the default).
	let lastOpen = false;
	$effect(() => {
		if (open && !lastOpen) {
			const publishedKeys = new Set(currentPublications.map((p) => p.platform));
			selected = platforms.activeItems.map((p) => p.key).filter((k) => !publishedKeys.has(k));
			error = null;
		}
		lastOpen = open;
	});

	function alreadyPublished(platform: PublicationPlatform): boolean {
		return currentPublications.some((p) => p.platform === platform);
	}

	function isSelected(platform: PublicationPlatform): boolean {
		return selected.includes(platform);
	}

	function toggle(platform: PublicationPlatform) {
		if (!canManage) return;
		if (isSelected(platform)) {
			selected = selected.filter((p) => p !== platform);
		} else {
			selected = [...selected, platform];
		}
	}

	function mergePublications(saved: PostPublication[]): PostPublication[] {
		const remaining = currentPublications.filter(
			(p) => !saved.some((s) => s.platform === p.platform)
		);
		return [...remaining, ...saved];
	}

	async function onConfirm() {
		if (!canManage) {
			onClose();
			return;
		}
		if (saving || selected.length === 0) {
			onClose();
			return;
		}
		saving = true;
		error = null;
		try {
			const created = await Promise.all(
				selected.map((platform) => upsertPublication(postID, platform))
			);
			onSaved?.(mergePublications(created));
			onClose();
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Lưu thất bại';
		} finally {
			saving = false;
		}
	}
</script>

{#if open}
	<ModalSurface
		{open}
		label="Đánh dấu đã đăng"
		{onClose}
		containerClass="grid place-items-center px-4"
		panelClass="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
	>
		<header class="mb-3 flex items-start justify-between gap-3">
			<div>
				<h2 class="text-base font-semibold text-slate-900">Đã đăng ở đâu?</h2>
				<p class="mt-0.5 text-xs text-slate-500">
					{canManage
						? 'Chọn các nền tảng vừa đăng để mọi người tránh đăng trùng.'
						: 'Bạn không có quyền xác nhận trạng thái đã đăng.'}
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

		{#if !canManage}
			<p class="mb-3 rounded-md bg-slate-100 px-3 py-2 text-xs text-slate-600">
				Chỉ quản trị viên hoặc người được cấp quyền mới có thể xác nhận bài đã đăng.
			</p>
		{/if}

		<div class="grid grid-cols-2 gap-2">
			{#each platforms.activeItems as p (p.key)}
				{@const published = alreadyPublished(p.key)}
				{@const checked = isSelected(p.key)}
				<button
					type="button"
					disabled={published || saving || !canManage}
					onclick={() => toggle(p.key)}
					aria-pressed={checked}
					class="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-60 {checked
						? `${p.tone} border-transparent`
						: published
							? `${p.tone} border-transparent opacity-75`
							: selectionStyles.outlineInactive}"
				>
					<LucideIcon icon={p.icon} className="size-4" />
					<span class="flex-1 text-left">{p.label}</span>
					{#if published}
						<span class="icon-[lucide--check] text-sm" aria-hidden="true"></span>
					{/if}
				</button>
			{/each}
		</div>

		{#if error}
			<p class="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
		{/if}

		<footer class="mt-4 flex items-center justify-end gap-2">
			<button
				type="button"
				onclick={onClose}
				disabled={saving}
				class={`${buttonStyles.secondary} rounded-lg px-3 py-1.5 text-sm`}
			>
				Bỏ qua
			</button>
			<button
				type="button"
				onclick={onConfirm}
				disabled={saving || selected.length === 0 || !canManage}
				class={`${buttonStyles.primary} rounded-lg px-4 py-1.5 text-sm`}
			>
				{saving ? 'Đang lưu…' : 'Đã đăng'}
			</button>
		</footer>
	</ModalSurface>
{/if}
