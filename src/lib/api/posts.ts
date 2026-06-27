import type { CreatePostRequest, PageResponse, Post, UpdatePostRequest } from '$contracts/backend';
import { apiFetch } from './client';

export type FeedQuery = {
	q?: string;
	hashtag?: string;
	author?: string;
	unpublished_on?: string;
	limit?: number;
	offset?: number;
};

export function listFeed(query: FeedQuery = {}) {
	return apiFetch<PageResponse<Post>>('/feed', {
		query: query as Record<string, string | number | boolean | undefined | null>
	});
}

export function getPost(id: string) {
	return apiFetch<Post>(`/posts/${id}`);
}

export function createPost(body: CreatePostRequest) {
	return apiFetch<Post>('/posts', { method: 'POST', body });
}

export function updatePost(id: string, body: UpdatePostRequest) {
	return apiFetch<Post>(`/posts/${id}`, { method: 'PATCH', body });
}

export function deletePost(id: string) {
	return apiFetch<void>(`/posts/${id}`, { method: 'DELETE' });
}
