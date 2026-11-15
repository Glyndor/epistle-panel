"use client";

import { Slot } from "@radix-ui/react-slot";
import type * as React from "react";

import { cn } from "@/lib/class-names";
import {
	isPointerUncovered,
	lastInputWasTab,
	setPointerUncovered,
} from "./input-tracking";
import type { TooltipAlign, TooltipSide } from "./placement";
import { useTooltip } from "./use-tooltip";

export type { TooltipAlign, TooltipSide };

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
 * A tooltip is chrome: its text is not selectable (`select-none`). See
 * `docs/maintainers/cursor-and-selection.md`.
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
	/**
	 * What the tooltip says: the control's name, already translated. Text, or
	 * nodes when a part of it has to be isolated (a name taken from a message,
	 * in `<bdi>`). The tooltip is hidden from assistive technology either way:
	 * the control's accessible name comes from the control.
	 */
	label: React.ReactNode;
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
	const { place, hideTimer, tip, show, hide, dismiss, yieldTo } = useTooltip({
		side,
		align,
		disabled,
	});

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
						isPointerUncovered() &&
						event.pointerType !== "touch"
					) {
						setPointerUncovered(false);
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
					// Only for a focus the Tab key brought. A menu or a dialog
					// that closes hands the focus back to the control it was
					// opened from: that is no visit, and the name was read.
					if (
						lastInputWasTab() &&
						event.currentTarget.matches(":focus-visible")
					) {
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
					<span className="flex max-w-64 items-center gap-2 rounded-lg bg-foreground px-2 py-1 text-background text-xs shadow-raised select-none">
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
