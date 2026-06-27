<script lang="ts">
	const minScale = 1;
	const defaultMaxScale = 3;
	const largeImageMaxScale = 4;
	const doubleTapThresholdMs = 280;
	const dismissDistanceThreshold = 96;
	const dismissVelocityThreshold = 0.45;
	const wheelDismissThreshold = 140;

	export interface LightboxItem {
		src: string;
		alt?: string;
		thumbSrc?: string;
		width?: number | null;
		height?: number | null;
	}

	let {
		items,
		open = $bindable(false),
		index = $bindable(0)
	}: {
		items: LightboxItem[];
		open?: boolean;
		index?: number;
	} = $props();

	let dialogEl = $state<HTMLDivElement | null>(null);
	let viewportEl = $state<HTMLDivElement | null>(null);
	let mediaFrameEl = $state<HTMLDivElement | null>(null);
	let imageEl = $state<HTMLImageElement | null>(null);
	let viewportWidth = $state(0);
	let viewportHeight = $state(0);

	let scale = $state(minScale);
	let rotation = $state(0);
	let translateX = $state(0);
	let translateY = $state(0);
	let isDragging = $state(false);
	let isDismissDragging = $state(false);
	let dragPointerID: number | null = null;
	let dragStartX = 0;
	let dragStartY = 0;
	let dragOriginX = 0;
	let dragOriginY = 0;
	let dragStartAt = 0;
	let dismissTranslateY = $state(0);
	let pinchDistance = $state(0);
	let lastTapAt = 0;
	let lastZoomToggledAt = 0;
	let lastTouchAt = 0;
	let wheelDismissOffset = $state(0);
	let wheelDismissTimer: ReturnType<typeof setTimeout> | null = null;
	let suppressNextViewportClick = false;

	const hasMultiple = $derived(items.length > 1);
	const activeItem = $derived(items[index] ?? null);
	const clampedIndex = $derived(Math.min(Math.max(index, 0), Math.max(items.length - 1, 0)));
	const isQuarterTurn = $derived(Math.abs(rotation % 180) === 90);
	const mediaFrameStyle = $derived.by(() => 'max-width:100%; max-height:100%;');
	const imageBoxStyle = $derived.by(() => {
		if (!activeItem?.width || !activeItem?.height || !viewportWidth || !viewportHeight) {
			return 'max-width:100%; max-height:100%;';
		}

		const availableWidth = Math.max(0, viewportWidth - 32);
		const availableHeight = Math.max(0, viewportHeight - 128);

		if (!isQuarterTurn) {
			const aspect = activeItem.width / activeItem.height;
			let width = availableWidth;
			let height = width / aspect;

			if (height > availableHeight) {
				height = availableHeight;
				width = height * aspect;
			}

			return `width:${Math.max(0, width)}px; height:${Math.max(0, height)}px;`;
		}

		const aspect = activeItem.width / activeItem.height;
		let width = availableHeight;
		let height = width / aspect;

		if (height > availableWidth) {
			height = availableWidth;
			width = height * aspect;
		}

		return `width:${Math.max(0, width)}px; height:${Math.max(0, height)}px;`;
	});

	$effect(() => {
		if (!open) return;
		index = clampedIndex;
		dialogEl?.focus();
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = previousOverflow;
		};
	});

	$effect(() => {
		if (!open || !activeItem) return;
		resetTransform();
	});

	$effect(() => {
		viewportWidth = window.innerWidth;
		viewportHeight = window.innerHeight;
	});

	function close() {
		open = false;
		resetTransform();
	}

	function goTo(next: number) {
		if (items.length === 0) return;
		index = (next + items.length) % items.length;
	}

	function previous() {
		goTo(index - 1);
	}

	function next() {
		goTo(index + 1);
	}

	function maxScaleForItem() {
		if (!activeItem) return defaultMaxScale;
		return (activeItem.width ?? 0) >= 2000 || (activeItem.height ?? 0) >= 2000
			? largeImageMaxScale
			: defaultMaxScale;
	}

	function clampScale(nextScale: number) {
		return Math.min(maxScaleForItem(), Math.max(minScale, nextScale));
	}

	function getImageBounds() {
		const width = imageEl?.clientWidth ?? viewportEl?.clientWidth ?? 0;
		const height = imageEl?.clientHeight ?? viewportEl?.clientHeight ?? 0;
		return { width, height };
	}

	function clampTranslation(nextX: number, nextY: number, nextScale = scale) {
		if (!viewportEl) return { x: nextX, y: nextY };

		const viewportRect = viewportEl.getBoundingClientRect();
		const imageBounds = getImageBounds();
		const scaledWidth = imageBounds.width * nextScale;
		const scaledHeight = imageBounds.height * nextScale;
		const maxX = Math.max(0, (scaledWidth - viewportRect.width) / 2);
		const maxY = Math.max(0, (scaledHeight - viewportRect.height) / 2);

		return {
			x: Math.min(maxX, Math.max(-maxX, nextX)),
			y: Math.min(maxY, Math.max(-maxY, nextY))
		};
	}

	function applyTranslation(nextX: number, nextY: number, nextScale = scale) {
		const clamped = clampTranslation(nextX, nextY, nextScale);
		translateX = clamped.x;
		translateY = clamped.y;
	}

	function getTranslationForAnchor(
		anchorClientX: number,
		anchorClientY: number,
		nextScale: number,
		previousScale = scale,
		previousTranslateX = translateX,
		previousTranslateY = translateY
	) {
		if (!viewportEl) {
			return { x: previousTranslateX, y: previousTranslateY };
		}

		const rect = viewportEl.getBoundingClientRect();
		const anchorOffsetX = anchorClientX - rect.left - rect.width / 2;
		const anchorOffsetY = anchorClientY - rect.top - rect.height / 2;
		const contentX = (anchorOffsetX - previousTranslateX) / previousScale;
		const contentY = (anchorOffsetY - previousTranslateY) / previousScale;

		return {
			x: anchorOffsetX - contentX * nextScale,
			y: anchorOffsetY - contentY * nextScale
		};
	}

	function resetPanZoom() {
		scale = minScale;
		translateX = 0;
		translateY = 0;
		isDragging = false;
		isDismissDragging = false;
		dragPointerID = null;
		pinchDistance = 0;
		dismissTranslateY = 0;
		wheelDismissOffset = 0;
		if (wheelDismissTimer) {
			clearTimeout(wheelDismissTimer);
			wheelDismissTimer = null;
		}
	}

	function resetTransform() {
		resetPanZoom();
		rotation = 0;
	}

	function zoomTo(nextScale: number, originX?: number, originY?: number) {
		if (!viewportEl) {
			scale = clampScale(nextScale);
			return;
		}

		const rect = viewportEl.getBoundingClientRect();
		const targetScale = clampScale(nextScale);

		if (targetScale === minScale) {
			resetPanZoom();
			return;
		}

		const anchorX = originX ?? rect.left + rect.width / 2;
		const anchorY = originY ?? rect.top + rect.height / 2;
		const nextTranslation = getTranslationForAnchor(anchorX, anchorY, targetScale);

		scale = targetScale;
		applyTranslation(nextTranslation.x, nextTranslation.y, targetScale);
	}

	function toggleZoom(originX?: number, originY?: number) {
		const now = Date.now();
		if (now - lastZoomToggledAt < 400) return;
		lastZoomToggledAt = now;

		if (scale > minScale) {
			resetPanZoom();
			return;
		}

		zoomTo(2, originX, originY);
	}

	function distanceBetweenTouches(touches: TouchList) {
		if (touches.length < 2) return 0;
		const [first, second] = [touches[0], touches[1]];
		return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
	}

	function midpointBetweenTouches(touches: TouchList) {
		const [first, second] = [touches[0], touches[1]];
		return {
			x: (first.clientX + second.clientX) / 2,
			y: (first.clientY + second.clientY) / 2
		};
	}

	function handlePointerDown(event: PointerEvent) {
		if (scale <= minScale) {
			isDismissDragging = true;
			dragPointerID = event.pointerId;
			dragStartX = event.clientX;
			dragStartY = event.clientY;
			dragOriginY = dismissTranslateY;
			dragStartAt = performance.now();
			viewportEl?.setPointerCapture(event.pointerId);
			return;
		}

		isDragging = true;
		dragPointerID = event.pointerId;
		dragStartX = event.clientX;
		dragStartY = event.clientY;
		dragOriginX = translateX;
		dragOriginY = translateY;
		viewportEl?.setPointerCapture(event.pointerId);
	}

	function handlePointerMove(event: PointerEvent) {
		if (!isDragging || dragPointerID !== event.pointerId) {
			if (!isDismissDragging || dragPointerID !== event.pointerId) return;

			const deltaX = event.clientX - dragStartX;
			const deltaY = event.clientY - dragStartY;
			if (Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
				dismissTranslateY = 0;
				return;
			}

			dismissTranslateY = dragOriginY + deltaY;
			return;
		}

		applyTranslation(
			dragOriginX + (event.clientX - dragStartX),
			dragOriginY + (event.clientY - dragStartY)
		);
	}

	function handlePointerEnd(event: PointerEvent) {
		if (dragPointerID !== event.pointerId) return;

		if (isDismissDragging) {
			const elapsedMs = Math.max(1, performance.now() - dragStartAt);
			const velocityY = dismissTranslateY / elapsedMs;
			const shouldDismiss =
				Math.abs(dismissTranslateY) >= dismissDistanceThreshold ||
				Math.abs(velocityY) >= dismissVelocityThreshold;

			isDismissDragging = false;
			dragPointerID = null;
			if (viewportEl?.hasPointerCapture(event.pointerId)) {
				viewportEl.releasePointerCapture(event.pointerId);
			}
			if (shouldDismiss) {
				close();
				return;
			}
			dismissTranslateY = 0;
			return;
		}

		isDragging = false;
		dragPointerID = null;
		if (viewportEl?.hasPointerCapture(event.pointerId)) {
			viewportEl.releasePointerCapture(event.pointerId);
		}
	}

	function handleTouchStart(event: TouchEvent) {
		lastTouchAt = Date.now();
		if (event.touches.length >= 2) {
			isDismissDragging = false;
			pinchDistance = distanceBetweenTouches(event.touches);
			return;
		}

		if (event.touches.length !== 1) return;

		const now = Date.now();
		if (now - lastTapAt < doubleTapThresholdMs) {
			toggleZoom(event.touches[0].clientX, event.touches[0].clientY);
			lastTapAt = 0;
			event.preventDefault();
			return;
		}

		lastTapAt = now;
	}

	function handleTouchMove(event: TouchEvent) {
		if (event.touches.length !== 2 || !pinchDistance) return;

		event.preventDefault();
		const midpoint = midpointBetweenTouches(event.touches);
		const nextDistance = distanceBetweenTouches(event.touches);
		const nextScale = clampScale(scale * (nextDistance / pinchDistance));
		const nextTranslation = getTranslationForAnchor(midpoint.x, midpoint.y, nextScale);
		scale = nextScale;
		applyTranslation(nextTranslation.x, nextTranslation.y, nextScale);
		pinchDistance = nextDistance;
	}

	function handleTouchEnd(event: TouchEvent) {
		if (event.touches.length < 2) {
			pinchDistance = 0;
		}

		if (scale <= minScale) {
			resetPanZoom();
		}
	}

	function handleWheel(event: WheelEvent) {
		if (!open) return;

		if (event.ctrlKey || event.metaKey) {
			event.preventDefault();
			zoomTo(scale - event.deltaY * 0.01, event.clientX, event.clientY);
			return;
		}

		if (scale > minScale) return;

		wheelDismissOffset += event.deltaY;
		dismissTranslateY = wheelDismissOffset;
		if (wheelDismissTimer) clearTimeout(wheelDismissTimer);
		wheelDismissTimer = setTimeout(() => {
			dismissTranslateY = 0;
			wheelDismissOffset = 0;
			wheelDismissTimer = null;
		}, 120);

		if (Math.abs(wheelDismissOffset) >= wheelDismissThreshold) {
			close();
		}
	}

	function markMediaInteraction() {
		suppressNextViewportClick = true;
	}
</script>

<svelte:window
	onresize={() => {
		viewportWidth = window.innerWidth;
		viewportHeight = window.innerHeight;
	}}
	onkeydown={(event) => {
		if (!open) return;
		if (event.key === 'Escape') {
			event.preventDefault();
			close();
			return;
		}
		if (event.key === '+' || event.key === '=') {
			event.preventDefault();
			zoomTo(scale + 0.5);
			return;
		}
		if (event.key === '-') {
			event.preventDefault();
			zoomTo(scale - 0.5);
			return;
		}
		if (!hasMultiple) return;
		if (event.key === 'ArrowLeft') {
			event.preventDefault();
			previous();
		}
		if (event.key === 'ArrowRight') {
			event.preventDefault();
			next();
		}
	}}
/>

{#if open && activeItem}
	<div
		class="fixed inset-0 z-[70] bg-black/85 transition-opacity duration-200"
		role="presentation"
		style={`opacity: ${Math.max(0.18, 0.85 - Math.min(0.55, Math.abs(dismissTranslateY) / 220))};`}
		onclick={close}
	></div>

	<div
		class="fixed inset-0 z-[71] flex items-center justify-center"
		role="presentation"
		style={`transform: translate3d(0, ${dismissTranslateY}px, 0); transition: ${
			isDismissDragging ? 'none' : 'transform 300ms cubic-bezier(0.2, 0.9, 0.1, 1)'
		};`}
	>
		<div
			bind:this={dialogEl}
			role="dialog"
			aria-modal="true"
			aria-label="Xem ảnh"
			tabindex="-1"
			class="relative flex h-dvh w-full flex-col px-3 py-3 text-white sm:px-6 sm:py-5"
			onclick={(event) => event.stopPropagation()}
			onkeydown={(event) => {
				if (event.key !== 'Escape') {
					event.stopPropagation();
				}
			}}
		>
			<div
				class="flex items-center justify-between gap-3"
				role="presentation"
				onclick={(event) => {
					if (event.target === event.currentTarget) {
						close();
					}
				}}
			>
				<div class="min-w-0 text-sm font-medium text-white/85">
					{#if hasMultiple}
						Ảnh {index + 1} / {items.length}
					{:else}
						Xem ảnh
					{/if}
				</div>

				<div class="flex items-center gap-2">
					<button
						type="button"
						aria-label="Xoay trái 90 độ"
						class="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
						onclick={(event) => {
							event.stopPropagation();
							rotation = (rotation - 90) % 360;
							resetPanZoom();
						}}
					>
						<span class="icon-[lucide--rotate-ccw] size-5" aria-hidden="true"></span>
					</button>
					<button
						type="button"
						aria-label="Thu nhỏ"
						disabled={scale <= minScale}
						class="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-40"
						onclick={(event) => {
							event.stopPropagation();
							zoomTo(scale - 0.5);
						}}
					>
						<span class="icon-[lucide--zoom-out] size-5" aria-hidden="true"></span>
					</button>
					<button
						type="button"
						aria-label="Phóng to"
						disabled={scale >= maxScaleForItem()}
						class="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-40"
						onclick={(event) => {
							event.stopPropagation();
							zoomTo(scale + 0.5);
						}}
					>
						<span class="icon-[lucide--zoom-in] size-5" aria-hidden="true"></span>
					</button>
					<button
						type="button"
						class="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
						aria-label="Đóng"
						onclick={(event) => {
							event.stopPropagation();
							close();
						}}
					>
						<span class="icon-[lucide--x] size-5" aria-hidden="true"></span>
					</button>
				</div>
			</div>

			<div
				class="relative flex min-h-0 flex-1 items-center justify-center py-4 sm:py-6"
				role="presentation"
				onclick={(event) => {
					if (event.target === event.currentTarget) {
						close();
					}
				}}
			>
				{#if hasMultiple}
					<button
						type="button"
						class="absolute left-0 z-[72] grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:left-2"
						aria-label="Ảnh trước"
						onclick={(event) => {
							event.stopPropagation();
							previous();
						}}
					>
						<span class="icon-[lucide--chevron-left] size-6" aria-hidden="true"></span>
					</button>
				{/if}

				<div
					bind:this={viewportEl}
					class="flex h-full w-full items-center justify-center"
					role="presentation"
					style="touch-action: none;"
					onclick={(event) => {
						if (suppressNextViewportClick) {
							suppressNextViewportClick = false;
							event.stopPropagation();
							return;
						}
						if (!mediaFrameEl?.contains(event.target as Node)) {
							close();
							return;
						}
						event.stopPropagation();
					}}
					ondblclick={(event) => {
						if (!mediaFrameEl?.contains(event.target as Node)) {
							return;
						}
						event.stopPropagation();
						if (Date.now() - lastTouchAt < 1000) return;
						toggleZoom(event.clientX, event.clientY);
					}}
					onpointerdown={handlePointerDown}
					onpointermove={handlePointerMove}
					onpointerup={handlePointerEnd}
					onpointercancel={handlePointerEnd}
					onpointerleave={handlePointerEnd}
					ontouchstart={handleTouchStart}
					ontouchmove={handleTouchMove}
					ontouchend={handleTouchEnd}
					ontouchcancel={handleTouchEnd}
					onwheel={handleWheel}
				>
					<div
						bind:this={mediaFrameEl}
						class="flex shrink-0 items-center justify-center"
						style={mediaFrameStyle}
						role="presentation"
						onpointerdown={markMediaInteraction}
						onpointerup={markMediaInteraction}
						onclick={(event) => {
							markMediaInteraction();
							event.stopPropagation();
						}}
					>
						<img
							bind:this={imageEl}
							src={activeItem.src}
							alt={activeItem.alt ?? ''}
							draggable="false"
							class={`select-none rounded-xl object-contain ${
								scale > minScale ? 'cursor-grab active:cursor-grabbing' : ''
							}`}
							style={`${imageBoxStyle} transform: translate3d(${translateX}px, ${translateY}px, 0) scale(${scale}) rotate(${rotation}deg); transform-origin: center center; transition: ${
								isDragging || pinchDistance
									? 'none'
									: 'transform 300ms cubic-bezier(0.2, 0.9, 0.1, 1)'
							};`}
						/>
					</div>
				</div>

				{#if hasMultiple}
					<button
						type="button"
						class="absolute right-0 z-[72] grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:right-2"
						aria-label="Ảnh sau"
						onclick={(event) => {
							event.stopPropagation();
							next();
						}}
					>
						<span class="icon-[lucide--chevron-right] size-6" aria-hidden="true"></span>
					</button>
				{/if}
			</div>

			{#if hasMultiple}
				<div
					class="scrollbar-hidden flex gap-2 overflow-x-auto pb-1"
					role="presentation"
					onclick={(event) => {
						if (event.target === event.currentTarget) {
							close();
							return;
						}
						event.stopPropagation();
					}}
				>
					{#each items as item, itemIndex (item.src)}
						<button
							type="button"
							class="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 transition sm:h-20 sm:w-20 {itemIndex ===
							index
								? 'border-white ring-2 ring-white/70'
								: 'border-transparent opacity-70 hover:opacity-100'}"
							aria-label={`Xem ảnh ${itemIndex + 1}`}
							aria-pressed={itemIndex === index}
							onclick={() => goTo(itemIndex)}
						>
							<img
								src={item.thumbSrc ?? item.src}
								alt=""
								class="h-full w-full object-cover"
								loading="lazy"
							/>
						</button>
					{/each}
				</div>
			{/if}
		</div>
	</div>
{/if}
