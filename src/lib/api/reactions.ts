import type { ReactionSummary, ReactionTargetType } from '$contracts/backend';
import { apiFetch } from './client';

interface ToggleResponse {
	active: boolean;
	summaries: ReactionSummary[];
}

export function toggleReaction(target_type: ReactionTargetType, target_id: string, emoji: string) {
	return apiFetch<ToggleResponse>('/reactions', {
		method: 'POST',
		body: { target_type, target_id, emoji }
	});
}
