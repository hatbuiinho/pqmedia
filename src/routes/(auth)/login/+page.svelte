<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { login } from '$lib/api/auth';
	import { ApiError } from '$lib/api/client';
	import LotusMark from '$lib/components/brand/LotusMark.svelte';
	import PasswordField from '$lib/components/form/PasswordField.svelte';
	import { auth } from '$lib/stores/auth.svelte';
	import { APP_NAME } from '$lib/env';

	let email = $state('');
	let password = $state('');
	let busy = $state(false);
	let error = $state<string | null>(null);

	$effect(() => {
		if (auth.isAuthenticated) void goto(resolve('/feed'), { replaceState: true });
	});

	async function onSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (busy) return;
		busy = true;
		error = null;
		try {
			await login({ email, password });
			await goto(resolve('/feed'), { replaceState: true });
		} catch (err) {
			error = err instanceof ApiError ? err.message : 'Đăng nhập thất bại';
		} finally {
			busy = false;
		}
	}
</script>

<div class="mb-6 flex items-center gap-3">
	<LotusMark className="h-12 w-12 shrink-0" />
	<div>
		<h1 class="mb-1 text-xl font-semibold">{APP_NAME}</h1>
		<p class="text-sm text-slate-500">Đăng nhập để xem bảng tin nội bộ</p>
	</div>
</div>

<form class="space-y-4" onsubmit={onSubmit}>
	<label class="block text-sm">
		<span class="mb-1 block font-medium text-slate-700">Email</span>
		<input
			type="email"
			bind:value={email}
			required
			autocomplete="email"
			class="w-full rounded-lg border-slate-300 focus:border-slate-500 focus:ring-slate-500"
		/>
	</label>

	<label class="block text-sm">
		<span class="mb-1 block font-medium text-slate-700">Mật khẩu</span>
		<PasswordField
			bind:value={password}
			required
			autocomplete="current-password"
			className="w-full rounded-lg border-slate-300 focus:border-slate-500 focus:ring-slate-500"
		/>
	</label>

	{#if error}
		<p class="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
	{/if}

	<button
		type="submit"
		disabled={busy}
		class="w-full rounded-lg bg-slate-900 px-4 py-2.5 font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
	>
		{busy ? 'Đang đăng nhập…' : 'Đăng nhập'}
	</button>
</form>
