"use client";

import { Slot } from "@radix-ui/react-slot";
import * as React from "react";

import { cn } from "@/lib/class-names";

/** Where the tooltip is anchored, in viewport pixels, from the control's rectangle. */
interface TooltipPlace {
	top: number;
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

function placeOf(
	box: DOMRect,
	side: TooltipSide,
	align: TooltipAlign,
): TooltipPlace {
	if (side === "right") {
		return { top: box.top, left: box.right, height: box.height };
	}
	if (align === "end") {
		// Anchored by its far edge, so a control at the end of a bar keeps its
		// tooltip inside the window.
		return {
			top: box.bottom,
			right: document.documentElement.clientWidth - box.right,
		};
	}
	return {
		top: box.bottom,
		left: align === "start" ? box.left : box.left + box.width / 2,
	};
}

/** Whether two places are the same, to the pixel. */
function samePlace(first: TooltipPlace, second: TooltipPlace): boolean {
	return (
		first.top === second.top &&
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
			const next = placeOf(element.getBoundingClientRect(), side, align);
			setPlace((current) =>
				current === null || samePlace(current, next) ? current : next,
			);
			frame = requestAnimationFrame(follow);
		};
		frame = requestAnimationFrame(follow);
		return () => cancelAnimationFrame(frame);
	}, [shown, side, align]);

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
				onPointerLeave={(event: React.PointerEvent<HTMLElement>) => {
					props.onPointerLeave?.(event);
					hide();
				}}
				onPointerDown={(event: React.PointerEvent<HTMLElement>) => {
					props.onPointerDown?.(event);
					dismiss();
				}}
				onFocus={(event: React.FocusEvent<HTMLElement>) => {
					props.onFocus?.(event);
					if (event.currentTarget.matches(":focus-visible")) {
						show(event.currentTarget);
					}
				}}
				onBlur={(event: React.FocusEvent<HTMLElement>) => {
					props.onBlur?.(event);
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
						dismiss();
					}
				}}
			>
				{children}
			</Slot>
			{!disabled && place ? (
				<span
					aria-hidden="true"
					data-slot={slot}
					data-side={side}
					onPointerEnter={() => clearTimeout(hideTimer.current)}
					onPointerLeave={hide}
					className={cn(
						"fixed z-50 flex",
						side === "right" ? "items-center ps-2" : "pt-1.5",
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
