"use client";

import { Slot } from "@radix-ui/react-slot";
import * as React from "react";

import { cn } from "@/lib/class-names";

/** Where the tooltip is anchored, in viewport pixels, from the control's rectangle. */
interface TooltipPlace {
	/** Set when the tooltip hangs under its control, or sits beside it. */
	top?: number;
	/** Set instead of `top` when the tooltip stands over its control. */
	bottom?: number;
	left?: number;
	right?: number;
	height?: number;
}

/** Milliseconds the tooltip stays after the pointer leaves, so it can be reached. */
const TOOLTIP_GRACE_MS = 120;

/** The side of the control the tooltip sits on. */
export type TooltipSide = "bottom" | "right";

/** With `side="bottom"`: which edge of the control the tooltip lines up with. */
export type TooltipAlign = "start" | "center" | "end";

/** The height a tooltip of one line takes with its gap, before it has been drawn and can be measured. */
const TOOLTIP_HEIGHT = 30;

function placeOf(
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
function samePlace(first: TooltipPlace, second: TooltipPlace): boolean {
	return (
		first.top === second.top &&
		first.bottom === second.bottom &&
		first.left === second.left &&
		first.right === second.right &&
		first.height === second.height
	);
}

/** Whether the control is the button of a menu or a dialog that is open, which would sit under the tooltip. */
function hasPopupOpen(element: HTMLElement): boolean {
	return (
		element.hasAttribute("aria-haspopup") &&
		element.getAttribute("aria-expanded") === "true"
	);
}

/**
 * Names the control given as its child, beside it: for a control that is an
 * icon alone, with its key when it has one. It is drawn here and not by a
 * popper library: it always sits on one known side of its control, so a
 * fixed-position box placed from the control's rectangle is enough, and the
 * page carries no positioning code.
 *
 * It shows on hover and on keyboard focus only, never on touch, stays while
 * the pointer is on it (WCAG 1.4.13), and Escape or a press of the control
 * dismisses it. It is not shown while the control's own menu or dialog is
 * open, which would sit under it. It repeats the control's
 * accessible name, so it is hidden from assistive tech; the key reaches it
 * through `aria-keyshortcuts` on the control. Its position is set on the
 * client through the CSSOM, which `style-src 'self'` allows; it is never in
 * the server HTML.
 *
 * While it shows it follows its control: the place is read again on every
 * frame, so the tooltip stays under a control that moves (the sidebar changing
 * width, the window being resized, a pane scrolling), and it goes when the
 * control stops being drawn.
 *
 * Props it does not know go to the control, so it can stand between a Radix
 * trigger (`asChild`) and its button.
 */
/** What a pointer can press: a tooltip lying over one of these gives way to it. */
const CONTROLS =
	"a[href], button, input, select, textarea, summary, label, [role='button'], [role='menuitem'], [role='tab']";

/** The values of `overflow` under which a box cuts off what leaves it. */
const CLIPS = new Set(["auto", "scroll", "hidden", "clip"]);

/**
 * Whether a control has been scrolled wholly out of a box that clips it: any
 * ancestor whose overflow is not `visible`. A control that is partly in view
 * is still there to be named.
 */
function scrolledAway(element: HTMLElement, box: DOMRect): boolean {
	for (
		let parent = element.parentElement;
		parent !== null;
		parent = parent.parentElement
	) {
		const style = getComputedStyle(parent);
		if (!CLIPS.has(style.overflowX) && !CLIPS.has(style.overflowY)) {
			continue;
		}
		const clip = parent.getBoundingClientRect();
		if (clip.width === 0 && clip.height === 0) {
			// Not laid out: it clips nothing that can be measured.
			continue;
		}
		if (
			box.bottom <= clip.top ||
			box.top >= clip.bottom ||
			box.right <= clip.left ||
			box.left >= clip.right
		) {
			return true;
		}
	}
	return false;
}

export function Tooltip({
	label,
	shortcut,
	side = "bottom",
	align = "center",
	disabled = false,
	slot = "tooltip",
	children,
	...props
}: {
	/** What the tooltip says: the control's name, already translated. */
	label: string;
	/** The key that does the same, as text ("Ctrl+B"), shown after the name. */
	shortcut?: string | undefined;
	side?: TooltipSide;
	align?: TooltipAlign;
	/** Never shown: for a control whose name is already written beside its icon. */
	disabled?: boolean;
	/** The `data-slot` of the tooltip's box. */
	slot?: string;
	children: React.ReactElement;
} & Omit<React.HTMLAttributes<HTMLElement>, "children">) {
	const [place, setPlace] = React.useState<TooltipPlace | null>(null);
	const hideTimer = React.useRef<ReturnType<typeof setTimeout>>(undefined);
	const control = React.useRef<HTMLElement | null>(null);
	const tip = React.useRef<HTMLSpanElement | null>(null);
	// Set by a press or a key that sent the tooltip away, until the pointer
	// leaves or the focus moves on: it must not come back under the same visit.
	const sentAway = React.useRef(false);

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
	// The pointer or the focus left the control: the next time is a new visit,
	// unless they left for the menu the control itself opened. That menu hands
	// the focus back when it closes, and the name was read before it opened.
	const endVisit = (element: HTMLElement) => {
		if (!hasPopupOpen(element)) {
			sentAway.current = false;
		}
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
				sentAway.current = true;
				clearTimeout(hideTimer.current);
				setPlace(null);
			}
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [shown]);

	return (
		<>
			<Slot
				{...props}
				onPointerEnter={(event: React.PointerEvent<HTMLElement>) => {
					props.onPointerEnter?.(event);
					if (event.pointerType !== "touch") {
						show(event.currentTarget);
					}
				}}
				onPointerMove={(event: React.PointerEvent<HTMLElement>) => {
					props.onPointerMove?.(event);
					// The pointer can be over the control with no entry told:
					// another tooltip lay over it and gave way under the pointer.
					if (
						place === null &&
						!sentAway.current &&
						event.pointerType !== "touch"
					) {
						show(event.currentTarget);
					}
				}}
				onPointerLeave={(event: React.PointerEvent<HTMLElement>) => {
					props.onPointerLeave?.(event);
					endVisit(event.currentTarget);
					hide();
				}}
				onPointerDown={(event: React.PointerEvent<HTMLElement>) => {
					props.onPointerDown?.(event);
					sentAway.current = true;
					dismiss();
				}}
				onFocus={(event: React.FocusEvent<HTMLElement>) => {
					props.onFocus?.(event);
					// A menu the control opened gives the focus back when it
					// closes: that is no new visit, and the name was just read.
					if (
						!sentAway.current &&
						event.currentTarget.matches(":focus-visible")
					) {
						show(event.currentTarget);
					}
				}}
				onBlur={(event: React.FocusEvent<HTMLElement>) => {
					props.onBlur?.(event);
					endVisit(event.currentTarget);
					hide();
				}}
				onKeyDown={(event: React.KeyboardEvent<HTMLElement>) => {
					props.onKeyDown?.(event);
					if (
						place &&
						(event.key === "Escape" ||
							event.key === "Enter" ||
							event.key === " ")
					) {
						sentAway.current = true;
						dismiss();
					}
				}}
			>
				{children}
			</Slot>
			{!disabled && place ? (
				<span
					ref={tip}
					aria-hidden="true"
					data-slot={slot}
					data-side={place.bottom === undefined ? side : "top"}
					onPointerEnter={(event) => {
						clearTimeout(hideTimer.current);
						yieldTo(event);
					}}
					onPointerMove={yieldTo}
					onPointerLeave={hide}
					className={cn(
						"fixed z-50 flex",
						side === "right"
							? "items-center ps-2"
							: place.bottom === undefined
								? "pt-1.5"
								: "pb-1.5",
						side === "bottom" &&
							align === "center" &&
							"-translate-x-1/2",
					)}
					// Placement from the control's rectangle, set on the client.
					style={place}
				>
					<span className="flex max-w-64 items-center gap-2 rounded-lg bg-foreground px-2 py-1 text-background text-xs shadow-raised">
						<span className="min-w-0 break-words">{label}</span>
						{shortcut === undefined ? null : (
							<span className="shrink-0 font-mono">
								{shortcut}
							</span>
						)}
					</span>
				</span>
			) : null}
		</>
	);
}
