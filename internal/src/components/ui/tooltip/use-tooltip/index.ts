import * as React from "react";

import { CONTROLS, scrolledAway } from "../clipping";
import { setPointerUncovered, watchInput } from "../input-tracking";
import {
	hasPopupOpen,
	placeOf,
	samePlace,
	type TooltipAlign,
	type TooltipPlace,
	type TooltipSide,
} from "../placement";

/** Milliseconds the tooltip stays after the pointer leaves, so it can be reached. */
const TOOLTIP_GRACE_MS = 120;

/**
 * The state of one tooltip: where it is, when it shows, how it follows its
 * control and what sends it away. The component only draws it.
 */
export function useTooltip({
	side,
	align,
	disabled,
}: {
	side: TooltipSide;
	align: TooltipAlign;
	disabled: boolean;
}) {
	const [place, setPlace] = React.useState<TooltipPlace | null>(null);
	const hideTimer = React.useRef<ReturnType<typeof setTimeout>>(undefined);
	const control = React.useRef<HTMLElement | null>(null);
	const tip = React.useRef<HTMLSpanElement | null>(null);
	React.useEffect(watchInput, []);

	const show = (element: HTMLElement) => {
		clearTimeout(hideTimer.current);
		if (!disabled && !hasPopupOpen(element)) {
			control.current = element;
			setPlace(placeOf(element.getBoundingClientRect(), side, align));
		}
	};
	const hide = () => {
		clearTimeout(hideTimer.current);
		hideTimer.current = setTimeout(() => setPlace(null), TOOLTIP_GRACE_MS);
	};
	const dismiss = () => {
		clearTimeout(hideTimer.current);
		setPlace(null);
	};
	// The tooltip can be reached with the pointer, so it must not stand between
	// the pointer and another control: over one that is not its own (the
	// button of the next row, 12 px away) it goes at once and the press lands.
	const yieldTo = (event: React.PointerEvent<HTMLElement>) => {
		const box = event.currentTarget;
		const under = document
			.elementsFromPoint?.(event.clientX, event.clientY)
			.find((element) => !box.contains(element));
		const other = under?.closest(CONTROLS);
		if (
			other !== null &&
			other !== undefined &&
			other !== control.current &&
			!control.current?.contains(other)
		) {
			setPointerUncovered(true);
			dismiss();
		}
	};
	React.useEffect(() => () => clearTimeout(hideTimer.current), []);

	const shown = place !== null;
	React.useEffect(() => {
		if (!shown) {
			return;
		}
		let frame = 0;
		const follow = () => {
			const element = control.current;
			// `checkVisibility` is false for a control that is no longer
			// drawn, such as one inside a part that was just hidden.
			if (
				element === null ||
				!element.isConnected ||
				element.checkVisibility?.() === false
			) {
				setPlace(null);
				return;
			}
			const box = element.getBoundingClientRect();
			if (scrolledAway(element, box)) {
				// The control left the box that scrolls it: a name drawn
				// over another zone would be the name of nothing in view.
				setPlace(null);
				return;
			}
			const next = placeOf(
				box,
				side,
				align,
				tip.current?.offsetHeight || undefined,
			);
			setPlace((current) =>
				current === null || samePlace(current, next) ? current : next,
			);
			frame = requestAnimationFrame(follow);
		};
		frame = requestAnimationFrame(follow);
		return () => cancelAnimationFrame(frame);
	}, [shown, side, align]);

	React.useEffect(() => {
		if (!shown) {
			return;
		}
		// Escape sends the tooltip away wherever the focus is: one the pointer
		// brought up is over a control that does not have it, and it must be
		// possible to dismiss it without moving the pointer.
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				clearTimeout(hideTimer.current);
				setPlace(null);
			}
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [shown]);

	return {
		place,
		setPlace,
		hideTimer,
		control,
		tip,
		show,
		hide,
		dismiss,
		yieldTo,
	};
}
