import type {
	PostPublication,
	PublicationPlatform,
	UpsertPublicationRequest
} from '$contracts/backend';
import { apiFetch } from './client';

interface PublicationListResponse {
	items: PostPublication[];
}

export function listPublications(postID: string) {
	return apiFetch<PublicationListResponse>(`/posts/${postID}/publications`);
}

export function upsertPublication(
	postID: string,
	platform: PublicationPlatform,
	body: UpsertPublicationRequest = {}
) {
	return apiFetch<PostPublication>(
		`/posts/${postID}/publications/${encodeURIComponent(platform)}`,
		{
			method: 'PUT',
			body
		}
	);
}

export function deletePublication(postID: string, platform: PublicationPlatform) {
	return apiFetch<void>(`/posts/${postID}/publications/${encodeURIComponent(platform)}`, {
		method: 'DELETE'
	});
}
