"use client";

import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import type * as React from "react";

import { cn } from "@/lib/class-names";

/**
 * Root of a menu opened from a trigger. It is not modal by default: a modal
 * Radix menu locks page scroll through react-remove-scroll, which injects a
 * `<style>` element that the panel's `style-src 'self'` refuses (measured in
 * the built server, a `style-src-elem` violation on every open). A non-modal
 * menu still closes on Escape and on an outside click.
 */
function DropdownMenu({
	modal = false,
	...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
	return (
		<DropdownMenuPrimitive.Root
			data-slot="dropdown-menu"
			modal={modal}
			{...props}
		/>
	);
}

/** The control that opens the menu. */
function DropdownMenuTrigger(
	props: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>,
) {
	return (
		<DropdownMenuPrimitive.Trigger
			data-slot="dropdown-menu-trigger"
			{...props}
		/>
	);
}

/**
 * The floating list. Radix positions it with script after it opens, which the
 * panel's `style-src 'self'` allows. It has no animation utilities. It renders
 * in place, not in a portal on `body`: in place it stays inside the sidebar's
 * landmark (a portal put it outside every region, an axe `region` violation)
 * and inside the mobile sheet, a top-layer dialog that a body portal would sit
 * behind.
 */
function DropdownMenuContent({
	className,
	sideOffset = 4,
	container,
	...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content> & {
	/**
	 * Where to render the list instead of in place: for a menu inside a box
	 * that clips what leaves it (a table that scrolls sideways). Give it an
	 * element inside a landmark, the page's `main`, never `body`.
	 */
	container?: HTMLElement | null;
}) {
	const content = (
		<DropdownMenuPrimitive.Content
			data-slot="dropdown-menu-content"
			sideOffset={sideOffset}
			className={cn(
				"z-50 min-w-40 rounded-xl bg-popover p-1.5 text-popover-foreground shadow-raised",
				className,
			)}
			{...props}
		/>
	);
	return container ? (
		<DropdownMenuPrimitive.Portal container={container}>
			{content}
		</DropdownMenuPrimitive.Portal>
	) : (
		content
	);
}

/** A heading for a run of items. */
function DropdownMenuLabel({
	className,
	...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label>) {
	return (
		<DropdownMenuPrimitive.Label
			data-slot="dropdown-menu-label"
			className={cn(
				"px-2 py-1.5 font-medium text-muted-foreground text-xs",
				className,
			)}
			{...props}
		/>
	);
}

/** A gap between two runs of items; it draws no line. */
function DropdownMenuSeparator({
	className,
	...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
	return (
		<DropdownMenuPrimitive.Separator
			data-slot="dropdown-menu-separator"
			className={cn("my-1.5", className)}
			{...props}
		/>
	);
}

/** A radio group whose items mark the current value. */
function DropdownMenuRadioGroup(
	props: React.ComponentProps<typeof DropdownMenuPrimitive.RadioGroup>,
) {
	return (
		<DropdownMenuPrimitive.RadioGroup
			data-slot="dropdown-menu-radio-group"
			{...props}
		/>
	);
}

/**
 * A radio item; `aria-checked` marks the current value. The pointer moves the
 * focus to the item under it, so the focus fill is also its hover, and a press
 * has a fill of its own.
 */
function DropdownMenuRadioItem({
	className,
	children,
	...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem>) {
	return (
		<DropdownMenuPrimitive.RadioItem
			data-slot="dropdown-menu-radio-item"
			className={cn(
				"relative flex min-h-8 cursor-default select-none items-center gap-2 rounded-lg ps-7 pe-2 text-sm focus:bg-accent focus:text-accent-foreground focus:outline-2 focus:-outline-offset-2 focus:outline-ring active:bg-accent/70 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 pointer-coarse:min-h-11",
				className,
			)}
			{...props}
		>
			<span className="absolute start-2 flex size-4 items-center justify-center">
				<DropdownMenuPrimitive.ItemIndicator>
					<span className="block size-2 rounded-full bg-current" />
				</DropdownMenuPrimitive.ItemIndicator>
			</span>
			{children}
		</DropdownMenuPrimitive.RadioItem>
	);
}

/**
 * An action of the menu. `variant="destructive"` is for one that removes
 * something; it still opens a confirmation, the colour only says what it is.
 * With `asChild` the item is the link or the button given as its child.
 */
function DropdownMenuItem({
	className,
	variant = "default",
	...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
	variant?: "default" | "destructive";
}) {
	return (
		<DropdownMenuPrimitive.Item
			data-slot="dropdown-menu-item"
			data-variant={variant}
			className={cn(
				"relative flex min-h-8 cursor-default select-none items-center gap-2 rounded-lg px-2 text-sm focus:bg-accent focus:text-accent-foreground focus:outline-2 focus:-outline-offset-2 focus:outline-ring data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[variant=default]:active:bg-accent/70 data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive-soft data-[variant=destructive]:focus:text-destructive pointer-coarse:min-h-11 [&_svg]:size-4 [&_svg]:shrink-0",
				className,
			)}
			{...props}
		/>
	);
}

export {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
};
