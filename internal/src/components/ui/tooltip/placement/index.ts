/** Where the tooltip is anchored, in viewport pixels, from the control's rectangle. */
export interface TooltipPlace {
	/** Set when the tooltip hangs under its control, or sits beside it. */
	top?: number;
	/** Set instead of `top` when the tooltip stands over its control. */
	bottom?: number;
	left?: number;
	right?: number;
	height?: number;
}

/** The side of the control the tooltip sits on. */
export type TooltipSide = "bottom" | "right";

/** With `side="bottom"`: which edge of the control the tooltip lines up with. */
export type TooltipAlign = "start" | "center" | "end";

/** The height a tooltip of one line takes with its gap, before it has been drawn and can be measured. */
const TOOLTIP_HEIGHT = 30;

/** The place of a tooltip from the rectangle of its control. */
export function placeOf(
	box: DOMRect,
	side: TooltipSide,
	align: TooltipAlign,
	tipHeight: number = TOOLTIP_HEIGHT,
): TooltipPlace {
	if (side === "right") {
		return { top: box.top, left: box.right, height: box.height };
	}
	const view = document.documentElement;
	// Under the control, unless it would leave the window there and fits
	// over it: a control on the last row in view is named above itself.
	const over =
		view.clientHeight > 0 &&
		box.bottom + tipHeight > view.clientHeight &&
		box.top - tipHeight >= 0;
	const block = over
		? { bottom: view.clientHeight - box.top }
		: { top: box.bottom };
	if (align === "end") {
		// Anchored by its far edge, so a control at the end of a bar keeps its
		// tooltip inside the window.
		return { ...block, right: view.clientWidth - box.right };
	}
	return {
		...block,
		left: align === "start" ? box.left : box.left + box.width / 2,
	};
}

/** Whether two places are the same, to the pixel. */
export function samePlace(first: TooltipPlace, second: TooltipPlace): boolean {
	return (
		first.top === second.top &&
		first.bottom === second.bottom &&
		first.left === second.left &&
		first.right === second.right &&
		first.height === second.height
	);
}

/** Whether the control is the button of a menu or a dialog that is open, which would sit under the tooltip. */
export function hasPopupOpen(element: HTMLElement): boolean {
	return (
		element.hasAttribute("aria-haspopup") &&
		element.getAttribute("aria-expanded") === "true"
	);
}
