<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { fetchMe, logout } from '$lib/api/auth';
	import { ApiError } from '$lib/api/client';
	import LotusMark from '$lib/components/brand/LotusMark.svelte';
	import ProfileMenu from '$lib/components/layout/ProfileMenu.svelte';
	import PostComposer from '$lib/components/post/PostComposer.svelte';
	import ModalSurface from '$lib/components/ui/ModalSurface.svelte';
	import ToastViewport from '$lib/components/ui/ToastViewport.svelte';
	import { auth } from '$lib/stores/auth.svelte';
	import { feedHashtagSidebar } from '$lib/stores/feedHashtagSidebar.svelte';
	import { notifications } from '$lib/stores/notifications.svelte';
	import { platforms } from '$lib/stores/platforms.svelte';
	import {
		currentPermission,
		pushSupportState,
		syncCurrentPushSubscription
	} from '$lib/push/web-push';
	import { APP_NAME } from '$lib/env';
	import { pushToast } from '$lib/stores/toast.svelte';

	let { children } = $props();
	let composerOpen = $state(false);
	let composerFullscreen = $state(false);
	const isFeedPage = $derived(page.url.pathname === resolve('/feed'));

	// Bottom-nav stays focused on browsing actions. Hồ sơ + admin + logout live
	// in the profile dropdown (ProfileMenu) at the top-right of the topbar.
	const navItems = [
		{ href: resolve('/feed'), label: 'Bảng tin', icon: 'icon-[lucide--newspaper]' },
		{
			href: resolve('/posts/new'),
			label: 'Đăng bài',
			icon: 'icon-[lucide--square-pen]',
			compose: true
		},
		{ href: resolve('/notifications'), label: 'Thông báo', icon: 'icon-[lucide--bell]' }
	];

	// Refresh principal once when the protected shell mounts. Kept out of +layout.ts
	// load() because writing to $state from there can re-trigger load(), and SvelteKit
	// also warns when load() uses window.fetch instead of event.fetch.
	onMount(() => {
		let cancelled = false;
		const messageHandler = (event: MessageEvent) => {
			if (!event.data || typeof event.data !== 'object') return;
			if (event.data.type === 'PUSH_NOTIFICATION_RECEIVED') {
				notifications.increaseUnread();
				void notifications.refresh().catch(() => undefined);
				const payload = event.data.payload as {
					title?: string;
					body?: string;
					url?: string;
				};
				pushToast(
					payload.body || 'Bạn có thông báo mới',
					'info',
					5000,
					{
						label: 'Mở',
						onClick: () => {
							if (payload.url) {
								window.location.assign(payload.url);
								return;
							}
							return goto(resolve('/notifications'));
						}
					},
					payload.title || 'Thông báo'
				);
				return;
			}
			if (event.data.type === 'PUSH_NOTIFICATION_CLICKED' && typeof event.data.url === 'string') {
				window.location.assign(event.data.url);
			}
		};

		if (browser && 'serviceWorker' in navigator) {
			navigator.serviceWorker.addEventListener('message', messageHandler);
		}

		void (async () => {
			try {
				await fetchMe();
				await Promise.all([platforms.ensureLoaded(true), notifications.refresh()]);

				if (
					!cancelled &&
					pushSupportState() === 'ready' &&
					(await currentPermission()) === 'granted'
				) {
					void syncCurrentPushSubscription(navigator.platform).catch(() => undefined);
				}
			} catch (err) {
				if (err instanceof ApiError && err.status === 401) {
					auth.clear();
					await goto(resolve('/login'), { replaceState: true });
				}
			}
		})();

		return () => {
			cancelled = true;
			if (browser && 'serviceWorker' in navigator) {
				navigator.serviceWorker.removeEventListener('message', messageHandler);
			}
		};
	});

	async function onLogout() {
		await logout();
		await goto(resolve('/login'), { replaceState: true });
	}

	function openComposer() {
		composerOpen = true;
	}

	function closeComposer() {
		composerOpen = false;
		composerFullscreen = false;
	}

	async function onComposerSubmitted() {
		composerOpen = false;
		await goto(resolve('/feed'), {
			replaceState: page.url.pathname === resolve('/feed')
		});
	}
</script>

<div class="flex min-h-dvh flex-col bg-slate-50">
	<ToastViewport />
	<header class="fixed inset-x-0 top-0 z-30 border-b border-slate-200/80 bg-white/88 backdrop-blur">
		<div
			class={`mx-auto flex items-center justify-between px-4 py-3 ${isFeedPage ? 'max-w-[88rem]' : 'max-w-3xl'}`}
		>
			<div class="flex items-center gap-2">
				{#if isFeedPage}
					<button
						type="button"
						onclick={() => feedHashtagSidebar.toggle()}
						class="grid h-9 w-9 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 lg:hidden"
						aria-label="Mở danh sách hashtag"
					>
						<span class="icon-[lucide--menu] size-5" aria-hidden="true"></span>
					</button>
				{/if}
				<a
					href={resolve('/feed')}
					class="flex items-center gap-2 rounded-full px-1 py-0.5 text-slate-900"
				>
					<LotusMark className="h-9 w-9" />
					<div class="min-w-0">
						<div class="truncate text-sm font-semibold">{APP_NAME}</div>
						<div class="hidden text-[11px] text-slate-500 sm:block">Ban truyền thông</div>
					</div>
				</a>
			</div>
			<ProfileMenu onLogout={() => onLogout()} />
		</div>
	</header>

	<main
		class={`mx-auto w-full flex-1 px-4 pt-[4.75rem] pb-32 ${isFeedPage ? 'max-w-[88rem]' : 'max-w-3xl'}`}
	>
		{@render children()}
	</main>

	<nav
		aria-label="Điều hướng chính"
		class="fixed right-3 bottom-3 left-3 z-30 mx-auto grid max-w-3xl grid-cols-3 gap-1 rounded-[1.2rem] border bg-white/94 p-1 backdrop-blur-lg [border-color:var(--app-border-strong)] sm:left-1/2 sm:w-[min(calc(100%-1.5rem),48rem)] sm:-translate-x-1/2"
	>
		{#each navItems as item (item.href)}
			{@const active = page.url.pathname.startsWith(item.href)}
			{#if item.compose}
				<button
					type="button"
					title={item.label}
					aria-label={item.label}
					aria-haspopup="dialog"
					aria-expanded={composerOpen}
					onclick={openComposer}
					class="grid -translate-y-3 justify-items-center rounded-[1rem] bg-linear-to-r from-[var(--app-primary)] to-[var(--app-secondary)] px-2 py-2.5 text-[0.72rem] font-bold text-white shadow-[0_14px_30px_rgba(68,105,156,0.24)] ring-4 ring-[var(--color-slate-50)] transition active:translate-y-[-0.65rem] sm:gap-0.5 sm:py-2"
				>
					<span class="{item.icon} text-2xl sm:text-xl" aria-hidden="true"></span>
					<span class="sr-only sm:not-sr-only">{item.label}</span>
				</button>
			{:else}
				<a
					href={item.href}
					title={item.label}
					aria-label={item.label}
					aria-current={active ? 'page' : undefined}
					class="relative grid justify-items-center rounded-[0.95rem] px-2 py-2 text-[0.72rem] font-semibold transition active:translate-y-px sm:gap-0.5 {active
						? 'bg-[var(--app-primary-soft)] text-[var(--app-primary-strong)]'
						: 'text-slate-500 hover:bg-slate-100/90 hover:text-slate-900'}"
				>
					<span class="{item.icon} text-2xl sm:text-xl" aria-hidden="true"></span>
					{#if item.href === resolve('/notifications') && notifications.unreadCount > 0}
						<span
							class="absolute top-1.5 right-3 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white shadow-sm"
							aria-label={`${notifications.unreadCount} thông báo chưa đọc`}
						>
							{notifications.unreadCount > 99 ? '99+' : notifications.unreadCount}
						</span>
					{/if}
					<span class="sr-only sm:not-sr-only">{item.label}</span>
				</a>
			{/if}
		{/each}
	</nav>
</div>

{#if composerOpen}
	<ModalSurface
		open={composerOpen}
		label="Tạo bài viết"
		onClose={closeComposer}
		containerClass="flex items-end sm:items-center sm:justify-center sm:p-4"
		panelClass={`flex w-full min-h-0 flex-col border border-slate-200 bg-slate-50 shadow-2xl ${
			composerFullscreen
				? 'sm:h-[calc(100dvh-1rem)] sm:w-[calc(100vw-1rem)] sm:rounded-[1.75rem]'
				: 'max-h-[85dvh] rounded-t-3xl sm:h-[min(52rem,calc(100dvh-4rem))] sm:w-[min(58rem,calc(100vw-2rem))] sm:rounded-3xl'
		}`}
	>
		<div class="mx-auto mt-3 mb-1 h-1.5 w-12 rounded-full bg-slate-300 sm:hidden"></div>
		<div
			class="flex items-center justify-between gap-3 border-b border-slate-200/80 px-4 py-3 sm:px-5"
		>
			<div class="min-w-0">
				<h2 class="text-base font-semibold text-slate-900">Đăng bài</h2>
				<p class="hidden text-xs text-slate-500 sm:block">
					Soạn nội dung, tải media nền và có thể đóng cửa sổ trong lúc hệ thống tiếp tục đăng.
				</p>
			</div>
			<div class="flex items-center gap-2">
				<button
					type="button"
					onclick={() => (composerFullscreen = !composerFullscreen)}
					class="hidden h-9 min-w-9 place-items-center rounded-full text-slate-500 transition hover:bg-slate-200 hover:text-slate-900 sm:grid"
					aria-label={composerFullscreen ? 'Thu nhỏ cửa sổ đăng bài' : 'Mở toàn màn hình'}
					title={composerFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
				>
					<span
						class={composerFullscreen
							? 'icon-[lucide--minimize-2] size-5'
							: 'icon-[lucide--maximize-2] size-5'}
						aria-hidden="true"
					></span>
				</button>
				<button
					type="button"
					onclick={closeComposer}
					class="grid h-9 w-9 place-items-center rounded-full text-slate-500 transition hover:bg-slate-200 hover:text-slate-900"
					aria-label="Đóng"
				>
					<span class="icon-[lucide--x] size-5" aria-hidden="true"></span>
				</button>
			</div>
		</div>

		<div class="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
			<PostComposer autofocus onSubmitted={() => onComposerSubmitted()} />
		</div>
	</ModalSurface>
{/if}
