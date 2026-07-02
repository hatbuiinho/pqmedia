import type { Principal } from '$contracts/backend';

export function canManagePublications(principal: Principal | null | undefined): boolean {
	return !!(principal?.user.is_admin || principal?.user.can_manage_publications);
}
