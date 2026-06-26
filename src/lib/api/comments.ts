import type { PostComment } from '$contracts/backend';
import { apiFetch } from './client';

interface CommentListResponse {
	items: PostComment[];
}

export function listComments(postID: string) {
	return apiFetch<CommentListResponse>(`/posts/${postID}/comments`);
}

export function createComment(postID: string, content: string) {
	return apiFetch<PostComment>(`/posts/${postID}/comments`, {
		method: 'POST',
		body: { content }
	});
}

export function deleteComment(commentID: string) {
	return apiFetch<void>(`/comments/${commentID}`, { method: 'DELETE' });
}
