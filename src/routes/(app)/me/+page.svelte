<script lang="ts">
	import { onMount } from 'svelte';
	import { ApiError } from '$lib/api/client';
	import { updateOwnProfile } from '$lib/api/users';
	import {
		disableWebPush,
		enableWebPush,
		isWebPushActive,
		pushSupportState
	} from '$lib/push/web-push';
	import { auth } from '$lib/stores/auth.svelte';

	let fullName = $state(auth.principal?.profile.full_name ?? '');
	let phone = $state(auth.principal?.profile.phone ?? '');
	let busy = $state(false);
	let message = $state<{ kind: 'ok' | 'err'; text: string } | null>(null);

	let pushActive = $state(false);
	let pushBusy = $state(false);
	let pushError = $state<string | null>(null);
	const supportState = pushSupportState();

	onMount(async () => {
		pushActive = await isWebPushActive();
	});

	async function onSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (busy) return;
		busy = true;
		message = null;
		try {
			const trimmedPhone = phone.trim();
			const updated = await updateOwnProfile({
				full_name: fullName.trim(),
				phone: trimmedPhone === '' ? null : trimmedPhone
			});
			auth.updatePrincipal(updated);
			message = { kind: 'ok', text: 'Đã lưu hồ sơ' };
		} catch (err) {
			message = {
				kind: 'err',
				text: err instanceof ApiError ? err.message : 'Lưu thất bại'
			};
		} finally {
			busy = false;
		}
	}

	async function onTogglePush() {
		if (pushBusy) return;
		pushBusy = true;
		pushError = null;
		try {
			if (pushActive) {
				await disableWebPush();
				pushActive = false;
			} else {
				await enableWebPush(navigator.platform);
				pushActive = true;
			}
		} catch (err) {
			pushError = err instanceof Error ? err.message : 'Không bật được thông báo';
		} finally {
			pushBusy = false;
		}
	}
</script>

<section class="space-y-4">
	<h1 class="text-xl font-semibold">Hồ sơ</h1>

	<form class="space-y-4 rounded-2xl bg-white p-4 shadow-sm" onsubmit={onSubmit}>
		<div class="text-sm text-slate-500">
			<span>Email: </span><span class="text-slate-700">{auth.principal?.user.email}</span>
		</div>

		<label class="block text-sm">
			<span class="mb-1 block font-medium text-slate-700">Họ tên</span>
			<input
				type="text"
				bind:value={fullName}
				required
				class="w-full rounded-lg border-slate-300 focus:border-slate-500 focus:ring-slate-500"
			/>
		</label>

		<label class="block text-sm">
			<span class="mb-1 block font-medium text-slate-700">Số điện thoại</span>
			<input
				type="tel"
				bind:value={phone}
				class="w-full rounded-lg border-slate-300 focus:border-slate-500 focus:ring-slate-500"
			/>
		</label>

		{#if message}
			<p
				class="rounded-md px-3 py-2 text-sm {message.kind === 'ok'
					? 'bg-emerald-50 text-emerald-700'
					: 'bg-rose-50 text-rose-700'}"
			>
				{message.text}
			</p>
		{/if}

		<button
			type="submit"
			disabled={busy}
			class="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
		>
			{busy ? 'Đang lưu…' : 'Lưu'}
		</button>
	</form>

	<div class="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
		<h2 class="text-sm font-semibold text-slate-700">Thông báo đẩy</h2>
		{#if supportState === 'unsupported'}
			<p class="text-sm text-slate-500">Trình duyệt này không hỗ trợ push notification.</p>
		{:else if supportState === 'insecure'}
			<p class="text-sm text-slate-500">Cần chạy qua HTTPS để bật thông báo.</p>
		{:else}
			<button
				type="button"
				disabled={pushBusy}
				onclick={onTogglePush}
				class="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-60"
			>
				{pushBusy ? 'Đang xử lý…' : pushActive ? 'Tắt thông báo' : 'Bật thông báo'}
			</button>
			{#if pushError}
				<p class="text-sm text-rose-600">{pushError}</p>
			{/if}
		{/if}
	</div>
</section>
