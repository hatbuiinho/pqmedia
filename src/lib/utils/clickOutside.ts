import type { Action } from 'svelte/action';

/**
 * Calls `callback` when a click lands outside the node (or Escape is pressed).
 * Usage:  <div use:clickOutside={() => (open = false)}>…</div>
 */
export const clickOutside: Action<HTMLElement, () => void> = (node, callback) => {
	function onPointerDown(event: MouseEvent) {
		if (!node.contains(event.target as Node)) callback();
	}
	function onKeyDown(event: KeyboardEvent) {
		if (event.key === 'Escape') callback();
	}
	document.addEventListener('pointerdown', onPointerDown, true);
	document.addEventListener('keydown', onKeyDown);
	return {
		destroy() {
			document.removeEventListener('pointerdown', onPointerDown, true);
			document.removeEventListener('keydown', onKeyDown);
		}
	};
};
