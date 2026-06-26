import type { AttachmentKind, PresignResponse } from '$contracts/backend';
import { apiFetch } from './client';

export interface UploadResult {
	bucket: string;
	object_key: string;
	kind: AttachmentKind | 'avatar';
	file_name: string;
	content_type: string;
	size_bytes: number;
	width?: number;
	height?: number;
	duration_ms?: number;
}

/** Two-step upload: presign with the BE, then PUT the file directly to MinIO. */
export async function uploadFile(
	file: File,
	kind: AttachmentKind | 'avatar'
): Promise<UploadResult> {
	const presign = await apiFetch<PresignResponse>('/uploads/presign', {
		method: 'POST',
		body: {
			file_name: file.name,
			content_type: file.type || 'application/octet-stream',
			kind
		}
	});

	const putResponse = await fetch(presign.upload_url, {
		method: 'PUT',
		headers: { 'Content-Type': file.type || 'application/octet-stream' },
		body: file
	});
	if (!putResponse.ok) {
		throw new Error(`upload failed: ${putResponse.status}`);
	}

	const dimensions = file.type.startsWith('image/') ? await readImageDimensions(file) : null;
	return {
		bucket: presign.bucket,
		object_key: presign.object_key,
		kind,
		file_name: file.name,
		content_type: file.type || 'application/octet-stream',
		size_bytes: file.size,
		width: dimensions?.width,
		height: dimensions?.height
	};
}

async function readImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
	return new Promise((resolve) => {
		const url = URL.createObjectURL(file);
		const img = new Image();
		img.onload = () => {
			URL.revokeObjectURL(url);
			resolve({ width: img.naturalWidth, height: img.naturalHeight });
		};
		img.onerror = () => {
			URL.revokeObjectURL(url);
			resolve(null);
		};
		img.src = url;
	});
}
