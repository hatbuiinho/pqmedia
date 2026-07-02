// Hand-written API contract between BE (Go) and FE (SvelteKit).
// Kept manual on purpose — keep types small and stable. Update both sides together.

// ---------- Auth ----------
export interface User {
	id: string;
	email: string;
	is_admin: boolean;
	can_manage_publications: boolean;
	is_active: boolean;
	created_at: string;
}

export interface UserProfile {
	user_id: string;
	full_name: string;
	phone: string | null;
	avatar_url: string | null;
}

export interface Principal {
	user: User;
	profile: UserProfile;
}

export interface LoginRequest {
	email: string;
	password: string;
}

export interface TokenPair {
	access_token: string;
	refresh_token: string;
	access_expires_at: string;
}

export interface LoginResponse extends TokenPair {
	principal: Principal;
}

export interface RefreshRequest {
	refresh_token: string;
}

// ---------- Posts ----------
export type AttachmentKind = 'image' | 'video';

export interface PostAttachment {
	id: string;
	post_id: string;
	kind: AttachmentKind;
	file_name: string;
	content_type: string;
	bucket: string;
	object_key: string;
	url: string;
	size_bytes: number;
	width: number | null;
	height: number | null;
	duration_ms: number | null;
	sort_order: number;
}

export interface PostAuthor {
	id: string;
	full_name: string;
	avatar_url: string | null;
}

export interface Post {
	id: string;
	author: PostAuthor;
	content: string;
	attachments: PostAttachment[];
	hashtags: string[];
	comment_count: number;
	reactions: ReactionSummary[];
	publications: PostPublication[];
	created_at: string;
	updated_at: string;
}

export interface PostAttachmentInput {
	kind: AttachmentKind;
	file_name: string;
	content_type: string;
	bucket: string;
	object_key: string;
	size_bytes: number;
	width?: number | null;
	height?: number | null;
	duration_ms?: number | null;
	sort_order?: number;
}

export interface CreatePostRequest {
	content: string;
	attachments: PostAttachmentInput[];
	hashtags: string[];
}

export interface UpdatePostRequest {
	content?: string;
	attachments?: PostAttachmentInput[];
	hashtags?: string[];
}

// ---------- Comments + Reactions ----------
export interface PostComment {
	id: string;
	post_id: string;
	author: PostAuthor;
	content: string;
	reactions: ReactionSummary[];
	created_at: string;
	updated_at: string;
}

export interface ReactionSummary {
	emoji: string;
	count: number;
	reacted_by_me: boolean;
}

export type ReactionTargetType = 'post' | 'comment';

export interface ToggleReactionRequest {
	target_type: ReactionTargetType;
	target_id: string;
	emoji: string;
}

// ---------- Publications ----------
export type PublicationPlatform = string;

export interface Platform {
	key: string;
	label: string;
	icon: string;
	tone: string;
	sort_order: number;
	is_active: boolean;
}

export interface PostPublication {
	id: string;
	post_id: string;
	platform: PublicationPlatform;
	external_url: string | null;
	published_at: string;
	published_by: PostAuthor;
	note: string | null;
}

export interface UpsertPublicationRequest {
	external_url?: string | null;
	published_at?: string;
	note?: string | null;
}

// ---------- Uploads ----------
export interface PresignRequest {
	file_name: string;
	content_type: string;
	kind: AttachmentKind | 'avatar';
}

export interface PresignResponse {
	bucket: string;
	object_key: string;
	upload_url: string;
	expires_at: string;
}

// ---------- Notifications + Push ----------
export type NotificationKind =
	| 'post_comment'
	| 'post_reaction'
	| 'comment_reaction'
	| 'post_mention'
	| 'post_created';

export interface AppNotification {
	id: string;
	recipient_user_id: string;
	actor: PostAuthor | null;
	kind: NotificationKind;
	post_id: string | null;
	comment_id: string | null;
	title: string;
	body: string;
	route_url: string | null;
	read_at: string | null;
	created_at: string;
}

export interface PushSubscriptionInput {
	endpoint: string;
	p256dh: string;
	auth: string;
	user_agent?: string;
	device_label?: string;
}

// ---------- Common ----------
export interface PageMeta {
	limit: number;
	offset: number;
	count: number;
	total: number;
}

export interface PageResponse<T> {
	items: T[];
	page: PageMeta;
}

export interface ApiError {
	code: string;
	message: string;
}

export interface ApiErrorResponse {
	error: ApiError;
}
