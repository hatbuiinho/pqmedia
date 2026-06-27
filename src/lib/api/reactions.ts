import type { ReactionSummary, ReactionTargetType } from '$contracts/backend';
import { apiFetch } from './client';

interface ToggleResponse {
	active: boolean;
	summaries: ReactionSummary[];
}

export function toggleReaction(
	target_type: ReactionTargetType,
	target_id: string,
	emoji: string,
	delta: number = 1
) {
	return apiFetch<ToggleResponse>('/reactions', {
		method: 'POST',
		body: { target_type, target_id, emoji, delta }
	});
}

export interface ReactionDetail {
	emoji: string;
	count: number;
	user_id: string;
	full_name: string;
	avatar_url?: string;
	created_at: string;
}

interface DetailsResponse {
	details: ReactionDetail[];
}

export function getReactionDetails(target_type: ReactionTargetType, target_id: string) {
	return apiFetch<DetailsResponse>(
		`/reactions/details?target_type=${target_type}&target_id=${target_id}`,
		{
			method: 'GET'
		}
	);
}
