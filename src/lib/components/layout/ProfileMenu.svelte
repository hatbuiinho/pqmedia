<script lang="ts">
	import { resolve } from '$app/paths';
	import { auth } from '$lib/stores/auth.svelte';
	import { clickOutside } from '$lib/utils/clickOutside';

	interface Props {
		onLogout: () => void;
	}

	let { onLogout }: Props = $props();

	let open = $state(false);

	const fullName = $derived(auth.principal?.profile.full_name ?? auth.principal?.user.email ?? '');
	const initial = $derived((fullName.trim().charAt(0) || '?').toUpperCase());
	const isAdmin = $derived(auth.principal?.user.is_admin ?? false);

	function close() {
		open = false;
	}
</script>

<div class="relative" use:clickOutside={close}>
	<button
		type="button"
		onclick={() => (open = !open)}
		aria-haspopup="menu"
		aria-expanded={open}
		class="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pr-2 pl-1 text-sm text-slate-700 transition hover:bg-slate-50"
	>
		<span
			class="grid h-7 w-7 place-items-center rounded-full bg-slate-900 text-xs font-semibold text-white"
		>
			{initial}
		</span>
		<span class="hidden max-w-[10rem] truncate sm:inline">{fullName}</span>
		<span class="icon-[lucide--chevron-down] text-base text-slate-400" aria-hidden="true"></span>
	</button>

	{#if open}
		<div
			role="menu"
			aria-label="Tài khoản"
			class="absolute right-0 z-40 mt-2 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
		>
			<div class="border-b border-slate-100 px-3 py-2 text-xs text-slate-500">
				Đăng nhập với
				<div class="truncate text-sm font-medium text-slate-800">
					{auth.principal?.user.email}
				</div>
			</div>

			<a
				href={resolve('/me')}
				role="menuitem"
				onclick={close}
				class="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
			>
				<span class="icon-[lucide--user] text-base text-slate-500" aria-hidden="true"></span>
				Hồ sơ
			</a>

			{#if isAdmin}
				<a
					href={resolve('/users')}
					role="menuitem"
					onclick={close}
					class="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
				>
					<span class="icon-[lucide--users] text-base text-slate-500" aria-hidden="true"></span>
					Quản trị người dùng
				</a>
			{/if}

			<div class="my-1 border-t border-slate-100"></div>

			<button
				type="button"
				role="menuitem"
				onclick={() => {
					close();
					onLogout();
				}}
				class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
			>
				<span class="icon-[lucide--log-out] text-base" aria-hidden="true"></span>
				Đăng xuất
			</button>
		</div>
	{/if}
</div>
