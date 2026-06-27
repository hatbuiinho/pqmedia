<script lang="ts">
	import type { PostPublication, PublicationPlatform } from '$contracts/backend';
	import { ApiError } from '$lib/api/client';
	import { upsertPublication } from '$lib/api/publications';
	import { PLATFORMS } from '$lib/constants/platforms';
	import { clickOutside } from '$lib/utils/clickOutside';

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

	// Reset selection each time the dialog opens — auto-tick the platforms that
	// have not been marked yet so user just confirms ("đăng đủ" is the default).
	let lastOpen = false;
	$effect(() => {
		if (open && !lastOpen) {
			const publishedKeys = new Set(currentPublications.map((p) => p.platform));
			selected = PLATFORMS.map((p) => p.key).filter((k) => !publishedKeys.has(k));
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
	<div
		class="fixed inset-0 z-40 grid place-items-center bg-black/40 backdrop-blur-sm px-4"
		role="presentation"
	>
		<div
			class="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
			role="dialog"
			aria-modal="true"
			aria-label="Đánh dấu đã đăng"
			use:clickOutside={{ enabled: open, onDismiss: onClose }}
		>
			<header class="mb-3 flex items-start justify-between gap-3">
				<div>
					<h2 class="text-base font-semibold text-slate-900">Đã đăng ở đâu?</h2>
					<p class="mt-0.5 text-xs text-slate-500">
						Chọn nền tảng bạn vừa đăng để app khỏi nhắc đăng lại.
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

			<div class="grid grid-cols-2 gap-2">
				{#each PLATFORMS as p (p.key)}
					{@const published = alreadyPublished(p.key)}
					{@const checked = isSelected(p.key)}
					<button
						type="button"
						disabled={published || saving}
						onclick={() => toggle(p.key)}
						aria-pressed={checked}
						class="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-60 {checked
							? 'border-slate-900 bg-slate-900 text-white'
							: published
								? 'border-emerald-200 bg-emerald-50 text-emerald-700'
								: 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'}"
					>
						<span class="{p.icon} text-base" aria-hidden="true"></span>
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
					class="rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100 disabled:opacity-60"
				>
					Bỏ qua
				</button>
				<button
					type="button"
					onclick={onConfirm}
					disabled={saving || selected.length === 0}
					class="rounded-lg bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
				>
					{saving ? 'Đang lưu…' : 'Đã đăng'}
				</button>
			</footer>
		</div>
	</div>
{/if}
