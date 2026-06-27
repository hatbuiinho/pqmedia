// Thin wrapper around the Web Share API.
// We deliberately keep this UI-agnostic so PostCard/ShareSheet just orchestrate.
//
// Browser support (Nov 2024):
//   - iOS Safari 15+ : text + files (multi)
//   - Android Chrome : text + files
//   - Desktop Chrome/Edge (Win 11+) : text + files (subset)
//   - Firefox / older Safari : no Web Share — fall back to copy-to-clipboard.

import type { PostAttachment } from '$contracts/backend';

export type ShareOutcome = 'shared' | 'aborted' | 'unsupported' | 'error';

interface SharePayload {
	text: string;
	files?: File[];
}

export function isShareSupported(): boolean {
	return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

export function canShareFiles(files: File[]): boolean {
	if (!isShareSupported()) return false;
	const canShare = navigator.canShare?.bind(navigator);
	if (!canShare) return false;
	try {
		return canShare({ files });
	} catch {
		return false;
	}
}

/** Calls navigator.share. Returns an outcome instead of throwing — UI just renders accordingly. */
export async function shareNative(payload: SharePayload): Promise<ShareOutcome> {
	if (!isShareSupported()) return 'unsupported';
	try {
		await navigator.share(payload as ShareData);
		return 'shared';
	} catch (err) {
		if (err instanceof DOMException && err.name === 'AbortError') return 'aborted';
		console.error('share failed', err);
		return 'error';
	}
}

/** Copies text to the clipboard. Returns true on success. */
export async function copyToClipboard(text: string): Promise<boolean> {
	if (typeof navigator === 'undefined' || !navigator.clipboard) return false;
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		return false;
	}
}

/**
 * Downloads every image attachment and converts them to File objects.
 * Videos are skipped per product decision (too large + receivers vary).
 * MinIO bucket must allow CORS for the FE origin — already public in dev.
 */
export async function fetchImagesAsFiles(attachments: PostAttachment[]): Promise<File[]> {
	const images = attachments.filter((a) => a.kind === 'image' && a.url);
	if (images.length === 0) return [];
	const files = await Promise.all(images.map(downloadAsFile));
	return files.filter((f): f is File => f !== null);
}

async function downloadAsFile(attachment: PostAttachment): Promise<File | null> {
	try {
		const res = await fetch(attachment.url, { mode: 'cors' });
		if (!res.ok) return null;
		const blob = await res.blob();
		const type = blob.type || attachment.content_type || 'application/octet-stream';
		return new File([blob], attachment.file_name || `image-${attachment.id}`, { type });
	} catch (err) {
		console.warn('share: failed to fetch attachment', attachment.url, err);
		return null;
	}
}
