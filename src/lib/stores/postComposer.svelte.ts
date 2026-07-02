import type {
	AttachmentKind,
	CreatePostRequest,
	Post,
	PostAttachment,
	PostAttachmentInput
} from '$contracts/backend';
import { ApiError } from '$lib/api/client';
import { createPost } from '$lib/api/posts';
import { uploadFile, type UploadResult } from '$lib/api/uploads';
import { applyManualHashtagSelection, dedupeHashtags } from '$lib/utils/hashtags';
import { auth } from './auth.svelte';
import { hashtags } from './hashtags.svelte';

export type DraftMediaStatus = 'uploading' | 'uploaded' | 'failed';
export type PublishStatus = 'idle' | 'waiting_uploads' | 'publishing' | 'failed';
export type FeedEntryStatus = 'waiting_uploads' | 'publishing' | 'failed' | 'published';

export interface DraftMediaEntry {
	id: string;
	file: File;
	kind: AttachmentKind;
	url: string;
	status: DraftMediaStatus;
	uploaded?: UploadResult;
	error?: string;
}

export interface ComposerFeedEntry {
	key: string;
	post: Post;
	status: FeedEntryStatus;
	error: string | null;
}

class PostComposerStore {
	content = $state('');
	selectedHashtags = $state<string[]>([]);
	media = $state<DraftMediaEntry[]>([]);
	publishStatus = $state<PublishStatus>('idle');
	error = $state<string | null>(null);
	feedEntries = $state<ComposerFeedEntry[]>([]);

	private pendingCounter = 0;
	private activeEntryKey = $state<string | null>(null);
	private dismissedContentHashtags = $state<string[]>([]);

	get hasDraft() {
		return this.content.trim() !== '' || this.media.length > 0;
	}

	get isPublishingLocked() {
		return this.publishStatus === 'waiting_uploads' || this.publishStatus === 'publishing';
	}

	get uploadingCount() {
		return this.media.filter((entry) => entry.status === 'uploading').length;
	}

	get failedCount() {
		return this.media.filter((entry) => entry.status === 'failed').length;
	}

	get canSubmit() {
		return this.hasDraft && !this.isPublishingLocked && this.failedCount === 0;
	}

	setContent(next: string) {
		if (this.isPublishingLocked) return;
		this.content = next;
		if (this.error && this.publishStatus !== 'failed') this.error = null;
	}

	toggleHashtag(name: string, checked: boolean) {
		if (this.isPublishingLocked) return;
		const next = applyManualHashtagSelection(
			this.selectedHashtags,
			this.dismissedContentHashtags,
			this.content,
			name,
			checked
		);
		this.selectedHashtags = next.selected;
		this.dismissedContentHashtags = next.dismissed;
	}

	selectHashtag(name: string) {
		if (this.isPublishingLocked) return;
		this.toggleHashtag(name, true);
	}

	seedHashtags(tags: string[]) {
		this.selectedHashtags = dedupeHashtags(tags);
		this.dismissedContentHashtags = [];
	}

	addFiles(files: File[]) {
		if (this.isPublishingLocked || files.length === 0) return;
		const imageFiles = files.filter((file) => file.type.startsWith('image/'));
		if (imageFiles.length === 0) {
			this.error = 'Trình soạn bài chỉ hỗ trợ tải ảnh.';
			return;
		}
		if (imageFiles.length !== files.length) {
			this.error = 'Video không được hỗ trợ trong trình soạn bài. Chỉ ảnh được thêm vào.';
		} else {
			this.error = null;
		}
		const next = imageFiles.map<DraftMediaEntry>((file) => ({
			id: `draft-media-${++this.pendingCounter}`,
			file,
			kind: 'image',
			url: URL.createObjectURL(file),
			status: 'uploading'
		}));
		this.media = [...this.media, ...next];
		for (const entry of next) void this.uploadEntry(entry.id);
	}

	removeMedia(id: string) {
		if (this.isPublishingLocked) return;
		const current = this.media.find((entry) => entry.id === id);
		if (current) URL.revokeObjectURL(current.url);
		this.media = this.media.filter((entry) => entry.id !== id);
	}

	reorderMedia(orderedIds: string[]) {
		if (this.isPublishingLocked) return;
		const byId = new Map(this.media.map((entry) => [entry.id, entry]));
		this.media = orderedIds
			.map((id) => byId.get(id))
			.filter((entry): entry is DraftMediaEntry => !!entry);
	}

	async submit(): Promise<boolean> {
		if (!this.canSubmit) return false;
		if (this.failedCount > 0) {
			this.error = 'Còn tệp tải lỗi. Hãy bỏ tệp lỗi và thêm lại trước khi đăng.';
			this.publishStatus = 'failed';
			return false;
		}

		if (!this.activeEntryKey) {
			this.activeEntryKey = `draft-post-${Date.now()}`;
		}

		const nextStatus: FeedEntryStatus = this.uploadingCount > 0 ? 'waiting_uploads' : 'publishing';
		this.publishStatus = this.uploadingCount > 0 ? 'waiting_uploads' : 'publishing';
		this.error = null;
		this.upsertFeedEntry(this.activeEntryKey, nextStatus, null);

		if (this.uploadingCount === 0) {
			void this.publishNow(this.activeEntryKey);
		}
		return true;
	}

	removeFeedEntry(key: string) {
		this.feedEntries = this.feedEntries.filter((entry) => entry.key !== key);
		if (this.activeEntryKey === key && this.publishStatus === 'failed') {
			this.activeEntryKey = null;
		}
	}

	updateFeedPost(postID: string, updater: (post: Post) => Post) {
		this.feedEntries = this.feedEntries.map((entry) =>
			entry.post.id === postID ? { ...entry, post: updater(entry.post) } : entry
		);
	}

	private async uploadEntry(id: string) {
		const entry = this.media.find((item) => item.id === id);
		if (!entry) return;
		try {
			const uploaded = await uploadFile(entry.file, entry.kind);
			if (!this.media.some((item) => item.id === id)) return;
			this.media = this.media.map((item) =>
				item.id === id ? { ...item, status: 'uploaded', uploaded, error: undefined } : item
			);
			if (this.publishStatus === 'waiting_uploads' && this.uploadingCount === 0) {
				if (this.failedCount > 0) {
					this.markPublishFailed('Có tệp tải lỗi. Hãy mở lại bài viết để xử lý.');
				} else if (this.activeEntryKey) {
					void this.publishNow(this.activeEntryKey);
				}
			}
		} catch (err) {
			if (!this.media.some((item) => item.id === id)) return;
			const message = err instanceof ApiError ? err.message : 'Tải ảnh/video lên thất bại';
			this.media = this.media.map((item) =>
				item.id === id ? { ...item, status: 'failed', error: message } : item
			);
			if (this.publishStatus === 'waiting_uploads') {
				this.markPublishFailed(message);
			}
		}
	}

	private async publishNow(entryKey: string) {
		if (this.failedCount > 0) {
			this.markPublishFailed('Còn tệp tải lỗi. Hãy mở lại bài viết để xử lý.');
			return;
		}
		if (this.uploadingCount > 0) {
			this.publishStatus = 'waiting_uploads';
			this.upsertFeedEntry(entryKey, 'waiting_uploads', null);
			return;
		}

		this.publishStatus = 'publishing';
		this.error = null;
		this.upsertFeedEntry(entryKey, 'publishing', null);

		try {
			const body: CreatePostRequest = {
				content: this.content.trim(),
				attachments: this.buildAttachmentInputs(),
				hashtags: this.selectedHashtags
			};
			const created = await createPost(body);
			this.feedEntries = this.feedEntries.map((entry) =>
				entry.key === entryKey
					? { key: created.id, post: created, status: 'published', error: null }
					: entry
			);
			void hashtags.refresh();
			this.clearDraftState();
		} catch (err) {
			const message = err instanceof ApiError ? err.message : 'Đăng bài thất bại';
			this.markPublishFailed(message);
		}
	}

	private markPublishFailed(message: string) {
		this.publishStatus = 'failed';
		this.error = message;
		if (this.activeEntryKey) {
			this.upsertFeedEntry(this.activeEntryKey, 'failed', message);
		}
	}

	private buildAttachmentInputs(): PostAttachmentInput[] {
		const out: PostAttachmentInput[] = [];
		for (const [sort_order, entry] of this.media.entries()) {
			if (!entry.uploaded) continue;
			out.push({
				kind: entry.kind,
				file_name: entry.uploaded.file_name,
				content_type: entry.uploaded.content_type,
				bucket: entry.uploaded.bucket,
				object_key: entry.uploaded.object_key,
				size_bytes: entry.uploaded.size_bytes,
				width: entry.uploaded.width ?? null,
				height: entry.uploaded.height ?? null,
				duration_ms: entry.uploaded.duration_ms ?? null,
				sort_order
			});
		}
		return out;
	}

	private upsertFeedEntry(key: string, status: FeedEntryStatus, error: string | null) {
		const post = this.buildOptimisticPost(key);
		const current = this.feedEntries.find((entry) => entry.key === key);
		if (current) {
			this.feedEntries = this.feedEntries.map((entry) =>
				entry.key === key ? { ...entry, post, status, error } : entry
			);
			return;
		}
		this.feedEntries = [{ key, post, status, error }, ...this.feedEntries];
	}

	private buildOptimisticPost(id: string): Post {
		const now = new Date().toISOString();
		const fullName =
			auth.principal?.profile.full_name?.trim() || auth.principal?.user.email || 'Bạn';
		const avatarURL = auth.principal?.profile.avatar_url ?? null;
		const attachments = this.media.map<PostAttachment>((entry, index) => ({
			id: `draft-attachment-${entry.id}`,
			post_id: id,
			kind: entry.kind,
			file_name: entry.file.name,
			content_type: entry.file.type || 'application/octet-stream',
			bucket: entry.uploaded?.bucket ?? '',
			object_key: entry.uploaded?.object_key ?? '',
			url: entry.url,
			size_bytes: entry.file.size,
			width: entry.uploaded?.width ?? null,
			height: entry.uploaded?.height ?? null,
			duration_ms: entry.uploaded?.duration_ms ?? null,
			sort_order: index
		}));
		return {
			id,
			author: {
				id: auth.principal?.user.id ?? 'me',
				full_name: fullName,
				avatar_url: avatarURL
			},
			content: this.content,
			attachments,
			hashtags: this.selectedHashtags,
			comment_count: 0,
			reactions: [],
			publications: [],
			created_at: now,
			updated_at: now
		};
	}

	private clearDraftState() {
		for (const entry of this.media) URL.revokeObjectURL(entry.url);
		this.content = '';
		this.selectedHashtags = [];
		this.dismissedContentHashtags = [];
		this.media = [];
		this.publishStatus = 'idle';
		this.error = null;
		this.activeEntryKey = null;
	}
}

export const postComposer = new PostComposerStore();
