"use client";

import { Slot } from "@radix-ui/react-slot";
import * as React from "react";

import { cn } from "@/lib/class-names";
import { useSidebar } from "../context";

/** The list of entries inside a group. */
export function SidebarMenu({
	className,
	...props
}: React.ComponentProps<"ul">) {
	return (
		<ul
			data-slot="sidebar-menu"
			className={cn("flex w-full min-w-0 flex-col gap-0.5", className)}
			{...props}
		/>
	);
}

/** One entry of a menu. */
export function SidebarMenuItem({
	className,
	...props
}: React.ComponentProps<"li">) {
	return (
		<li
			data-slot="sidebar-menu-item"
			className={cn("group/menu-item relative", className)}
			{...props}
		/>
	);
}

/** Where the tooltip sits, in viewport pixels, beside the control it names. */
interface TooltipPlace {
	top: number;
	left: number;
	height: number;
}

/** Milliseconds the tooltip stays after the pointer leaves, so it can be reached. */
const TOOLTIP_GRACE_MS = 120;

/**
 * The control of an entry: 32 px tall on a fine pointer (the sidebar item the
 * measured references use), 44 px on a coarse one. Collapsed to icons it is a
 * square, and a tooltip beside it carries the label.
 *
 * The tooltip is drawn here and not by a popper library: it always sits to the
 * right of a control, so a fixed-position box placed from the control's
 * rectangle is enough, and the page carries no positioning code. It is shown on
 * hover and on keyboard focus only, stays while the pointer is on it
 * (WCAG 1.4.13), and Escape dismisses it. It repeats the control's accessible
 * name, so it is hidden from assistive tech. Its position is set on the client
 * through the CSSOM, which `style-src 'self'` allows; it is never in the server
 * HTML.
 */
export function SidebarMenuButton({
	asChild = false,
	isActive = false,
	tooltip,
	className,
	onPointerEnter,
	onPointerLeave,
	onFocus,
	onBlur,
	onKeyDown,
	...props
}: React.ComponentProps<"button"> & {
	asChild?: boolean;
	isActive?: boolean;
	/** Label shown beside the icon while the sidebar is collapsed. */
	tooltip?: string;
}) {
	const Comp = asChild ? Slot : "button";
	const { isMobile, state } = useSidebar();
	const [place, setPlace] = React.useState<TooltipPlace | null>(null);
	const hideTimer = React.useRef<ReturnType<typeof setTimeout>>(undefined);
	const enabled = Boolean(tooltip) && state === "collapsed" && !isMobile;

	const show = (element: HTMLElement) => {
		clearTimeout(hideTimer.current);
		if (enabled) {
			const box = element.getBoundingClientRect();
			setPlace({ top: box.top, left: box.right, height: box.height });
		}
	};
	const hide = () => {
		clearTimeout(hideTimer.current);
		hideTimer.current = setTimeout(() => setPlace(null), TOOLTIP_GRACE_MS);
	};
	React.useEffect(() => () => clearTimeout(hideTimer.current), []);

	const button = (
		<Comp
			data-slot="sidebar-menu-button"
			data-active={isActive}
			className={cn(
				"flex min-h-8 w-full items-center gap-2 overflow-hidden rounded-lg px-2 text-left text-sm hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground focus-visible:outline-2 focus-visible:outline-sidebar-ring active:bg-sidebar-accent/80 disabled:pointer-events-none disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:font-semibold data-[active=true]:text-sidebar-accent-foreground data-[state=open]:bg-sidebar-accent pointer-coarse:min-h-11 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:pointer-coarse:size-11 group-data-[collapsible=icon]:[&>span]:sr-only [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0",
				className,
			)}
			onPointerEnter={(event) => {
				onPointerEnter?.(event);
				if (event.pointerType !== "touch") {
					show(event.currentTarget);
				}
			}}
			onPointerLeave={(event) => {
				onPointerLeave?.(event);
				hide();
			}}
			onFocus={(event) => {
				onFocus?.(event);
				if (event.currentTarget.matches(":focus-visible")) {
					show(event.currentTarget);
				}
			}}
			onBlur={(event) => {
				onBlur?.(event);
				hide();
			}}
			onKeyDown={(event) => {
				onKeyDown?.(event);
				if (event.key === "Escape" && place) {
					setPlace(null);
				}
			}}
			{...props}
		/>
	);

	if (!tooltip) {
		return button;
	}
	return (
		<>
			{button}
			{enabled && place ? (
				<span
					aria-hidden="true"
					data-slot="sidebar-tooltip"
					onPointerEnter={() => clearTimeout(hideTimer.current)}
					onPointerLeave={hide}
					className="fixed z-50 flex items-center ps-2"
					// Placement from the control's rectangle, set on the client.
					style={{
						top: place.top,
						left: place.left,
						height: place.height,
					}}
				>
					<span className="rounded-lg bg-foreground px-2 py-1 text-background text-xs shadow-raised">
						{tooltip}
					</span>
				</span>
			) : null}
		</>
	);
}
