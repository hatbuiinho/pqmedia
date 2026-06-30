<script lang="ts">
	import { onMount } from 'svelte';
	import { ApiError } from '$lib/api/client';
	import PasswordField from '$lib/components/form/PasswordField.svelte';
	import { changeOwnPassword, updateOwnProfile } from '$lib/api/users';
	import {
		currentPermission,
		disableWebPush,
		enableWebPush,
		syncCurrentPushSubscription,
		getCurrentPushSubscription,
		isWebPushActive,
		pushSupportState
	} from '$lib/push/web-push';
	import { auth } from '$lib/stores/auth.svelte';
	import { buttonStyles } from '$lib/styles/buttons';
	import { pushToast } from '$lib/stores/toast.svelte';

	let fullName = $state(auth.principal?.profile.full_name ?? '');
	let phone = $state(auth.principal?.profile.phone ?? '');
	let busy = $state(false);
	let message = $state<{ kind: 'ok' | 'err'; text: string } | null>(null);
	let passwordBusy = $state(false);
	let passwordMessage = $state<{ kind: 'ok' | 'err'; text: string } | null>(null);
	let currentPassword = $state('');
	let nextPassword = $state('');
	let confirmPassword = $state('');

	let pushActive = $state(false);
	let pushBusy = $state(false);
	let pushError = $state<string | null>(null);
	let pushPermission = $state<NotificationPermission | 'denied'>('denied');
	const supportState = pushSupportState();
	const pushReady = $derived(supportState === 'ready');
	const pushStatusLabel = $derived.by(() => {
		if (supportState === 'unsupported') return 'Không hỗ trợ';
		if (supportState === 'insecure') return 'Cần HTTPS';
		if (pushPermission === 'denied') return 'Đã chặn';
		if (pushActive) return 'Đã bật';
		if (pushPermission === 'granted') return 'Chưa đồng bộ';
		return 'Chưa bật';
	});
	const pushStatusTone = $derived.by(() => {
		if (
			supportState === 'unsupported' ||
			supportState === 'insecure' ||
			pushPermission === 'denied'
		) {
			return 'bg-rose-100 text-rose-700';
		}
		if (pushActive) return 'bg-emerald-100 text-emerald-700';
		if (pushPermission === 'granted') return 'bg-amber-100 text-amber-700';
		return 'bg-slate-100 text-slate-700';
	});
	const pushDescription = $derived.by(() => {
		if (supportState === 'unsupported') return 'Trình duyệt hiện tại không hỗ trợ Web Push.';
		if (supportState === 'insecure')
			return 'Cần truy cập ứng dụng qua HTTPS hoặc localhost để bật thông báo.';
		if (pushPermission === 'denied') {
			return 'Trình duyệt đã chặn quyền thông báo. Hãy mở lại quyền trong cài đặt của trình duyệt rồi tải lại trang.';
		}
		if (pushActive) return 'Thiết bị này đang nhận thông báo đẩy cho tài khoản hiện tại.';
		if (pushPermission === 'granted') {
			return 'Quyền thông báo đã được cấp nhưng subscription trên thiết bị này chưa sẵn sàng hoặc chưa đồng bộ.';
		}
		return 'Bật thông báo để nhận bình luận, reaction và các cập nhật mới ngay trên thiết bị này.';
	});

	onMount(async () => {
		await refreshPushState();
	});

	async function refreshPushState() {
		pushPermission = await currentPermission();
		pushActive = await isWebPushActive();
		if (supportState === 'ready' && pushPermission === 'granted') {
			const subscription = await getCurrentPushSubscription();
			if (subscription && !pushActive) {
				pushActive = true;
			}
			if (subscription) {
				await syncCurrentPushSubscription(navigator.platform).catch(() => undefined);
			}
		}
	}

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
				pushToast('Đã tắt thông báo trên thiết bị này.', 'success');
			} else {
				await enableWebPush(navigator.platform);
				pushToast('Đã bật thông báo trên thiết bị này.', 'success');
			}
			await refreshPushState();
		} catch (err) {
			pushError = err instanceof Error ? err.message : 'Không bật được thông báo';
			pushToast(pushError, 'error');
		} finally {
			pushBusy = false;
		}
	}

	async function onSubmitPassword(event: SubmitEvent) {
		event.preventDefault();
		if (passwordBusy) return;
		if (currentPassword.trim() === '') {
			passwordMessage = { kind: 'err', text: 'Vui lòng nhập mật khẩu hiện tại.' };
			return;
		}
		if (nextPassword.length < 8) {
			passwordMessage = { kind: 'err', text: 'Mật khẩu mới phải có ít nhất 8 ký tự.' };
			return;
		}
		if (nextPassword !== confirmPassword) {
			passwordMessage = { kind: 'err', text: 'Mật khẩu xác nhận không khớp.' };
			return;
		}

		passwordBusy = true;
		passwordMessage = null;
		try {
			await changeOwnPassword({
				current_password: currentPassword,
				password: nextPassword
			});
			currentPassword = '';
			nextPassword = '';
			confirmPassword = '';
			passwordMessage = { kind: 'ok', text: 'Đã cập nhật mật khẩu.' };
			pushToast('Đã cập nhật mật khẩu.', 'success');
		} catch (err) {
			passwordMessage = {
				kind: 'err',
				text: err instanceof ApiError ? err.message : 'Đổi mật khẩu thất bại'
			};
		} finally {
			passwordBusy = false;
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

		<button type="submit" disabled={busy} class={`${buttonStyles.primary} rounded-lg px-4 py-2`}>
			{busy ? 'Đang lưu…' : 'Lưu'}
		</button>
	</form>

	<form class="space-y-4 rounded-2xl bg-white p-4 shadow-sm" onsubmit={onSubmitPassword}>
		<div>
			<h2 class="text-sm font-semibold text-slate-700">Đổi mật khẩu</h2>
			<p class="mt-1 text-sm text-slate-500">
				Nhập mật khẩu hiện tại rồi đặt mật khẩu mới cho tài khoản này.
			</p>
		</div>

		<label class="block text-sm">
			<span class="mb-1 block font-medium text-slate-700">Mật khẩu hiện tại</span>
			<PasswordField
				bind:value={currentPassword}
				required
				autocomplete="current-password"
				className="w-full rounded-lg border-slate-300 focus:border-slate-500 focus:ring-slate-500"
			/>
		</label>

		<div class="grid gap-4 sm:grid-cols-2">
			<label class="block text-sm">
				<span class="mb-1 block font-medium text-slate-700">Mật khẩu mới</span>
				<PasswordField
					bind:value={nextPassword}
					required
					minlength={8}
					autocomplete="new-password"
					className="w-full rounded-lg border-slate-300 focus:border-slate-500 focus:ring-slate-500"
				/>
			</label>

			<label class="block text-sm">
				<span class="mb-1 block font-medium text-slate-700">Xác nhận mật khẩu mới</span>
				<PasswordField
					bind:value={confirmPassword}
					required
					minlength={8}
					autocomplete="new-password"
					className="w-full rounded-lg border-slate-300 focus:border-slate-500 focus:ring-slate-500"
				/>
			</label>
		</div>

		{#if passwordMessage}
			<p
				class="rounded-md px-3 py-2 text-sm {passwordMessage.kind === 'ok'
					? 'bg-emerald-50 text-emerald-700'
					: 'bg-rose-50 text-rose-700'}"
			>
				{passwordMessage.text}
			</p>
		{/if}

		<button
			type="submit"
			disabled={passwordBusy}
			class={`${buttonStyles.primary} rounded-lg px-4 py-2`}
		>
			{passwordBusy ? 'Đang cập nhật…' : 'Cập nhật mật khẩu'}
		</button>
	</form>

	<div class="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
		<div class="flex items-start justify-between gap-3">
			<div>
				<h2 class="text-sm font-semibold text-slate-700">Thông báo đẩy</h2>
				<p class="mt-1 text-sm text-slate-500">{pushDescription}</p>
			</div>
			<span class={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${pushStatusTone}`}>
				{pushStatusLabel}
			</span>
		</div>

		<div class="grid gap-2 text-sm sm:grid-cols-2">
			<div class="rounded-xl bg-slate-50 px-3 py-2">
				<div class="text-[11px] uppercase tracking-wide text-slate-400">Thiết bị này</div>
				<div class="mt-1 font-medium text-slate-700">
					{pushActive ? 'Đã đăng ký nhận push' : 'Chưa đăng ký'}
				</div>
			</div>
			<div class="rounded-xl bg-slate-50 px-3 py-2">
				<div class="text-[11px] uppercase tracking-wide text-slate-400">Quyền trình duyệt</div>
				<div class="mt-1 font-medium text-slate-700">
					{pushPermission === 'granted'
						? 'Đã cấp quyền'
						: pushPermission === 'denied'
							? 'Đã chặn'
							: 'Chưa quyết định'}
				</div>
			</div>
		</div>

		{#if pushReady}
			<div class="flex items-center gap-2">
				<button
					type="button"
					disabled={pushBusy}
					onclick={onTogglePush}
					class={`${pushActive ? buttonStyles.secondary : buttonStyles.primary} rounded-lg px-3 py-1.5 text-sm`}
				>
					{pushBusy ? 'Đang xử lý…' : pushActive ? 'Tắt thông báo' : 'Bật thông báo'}
				</button>
				<button
					type="button"
					disabled={pushBusy}
					onclick={refreshPushState}
					class={`${buttonStyles.secondary} rounded-lg px-3 py-1.5 text-sm`}
				>
					Làm mới trạng thái
				</button>
			</div>
		{/if}

		{#if pushError}
			<p class="text-sm text-rose-600">{pushError}</p>
		{/if}
	</div>
</section>
