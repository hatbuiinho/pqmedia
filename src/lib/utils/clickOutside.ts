import type { Action } from 'svelte/action';

/**
 * Calls `onDismiss` when a click lands outside the node (or Escape is pressed).
 * Only the top-most enabled layer reacts, so nested dialogs/menus do not all
 * close at once.
 * Usage:
 *   <div use:clickOutside={{ enabled: open, onDismiss: () => (open = false) }}>…</div>
 */
type DismissConfig = {
	enabled?: boolean;
	onDismiss: () => void;
};

const layerStack: symbol[] = [];

function removeLayer(id: symbol) {
	const index = layerStack.lastIndexOf(id);
	if (index >= 0) {
		layerStack.splice(index, 1);
	}
}

function normalize(value: (() => void) | DismissConfig): Required<DismissConfig> {
	if (typeof value === 'function') {
		return { enabled: true, onDismiss: value };
	}
	return {
		enabled: value.enabled ?? true,
		onDismiss: value.onDismiss
	};
}

export const clickOutside: Action<HTMLElement, (() => void) | DismissConfig> = (node, value) => {
	const layerID = Symbol('dismiss-layer');
	let config = normalize(value);

	function syncLayerState() {
		removeLayer(layerID);
		if (config.enabled) {
			layerStack.push(layerID);
		}
	}

	function isTopmost() {
		return layerStack[layerStack.length - 1] === layerID;
	}

	function onPointerDown(event: MouseEvent) {
		if (!config.enabled || !isTopmost()) return;
		if (!node.contains(event.target as Node)) config.onDismiss();
	}
	function onKeyDown(event: KeyboardEvent) {
		if (!config.enabled || !isTopmost()) return;
		if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			config.onDismiss();
		}
	}

	syncLayerState();
	document.addEventListener('pointerdown', onPointerDown, true);
	document.addEventListener('keydown', onKeyDown);
	return {
		update(nextValue) {
			config = normalize(nextValue);
			syncLayerState();
		},
		destroy() {
			removeLayer(layerID);
			document.removeEventListener('pointerdown', onPointerDown, true);
			document.removeEventListener('keydown', onKeyDown);
		}
	};
};
