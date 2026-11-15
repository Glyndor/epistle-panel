"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { type ComponentProps, useEffect, useMemo, useRef } from "react";
import {
	type Chevron,
	type DayButton,
	DayPicker,
	getDefaultClassNames,
} from "react-day-picker";

import { useDirection } from "@/components/ui/calendar/use-direction";
import { cn } from "@/lib/class-names";
import { FORCED_POINTER } from "@/lib/pointer-states";

/**
 * A month of days, one of which can be chosen: shadcn's `Calendar`, on
 * `react-day-picker`, made to the panel's rules (docs/maintainers/shadcn.md).
 *
 * - **No inline style.** The library writes a `style` attribute only from the
 *   `styles` prop, a dropdown caption and an animation, and none of the three
 *   is used: the caption is a label, the stylesheet of the library is not
 *   imported and `animate` stays off. A test renders it on the server and
 *   fails on a `style` attribute or element.
 * - **A real table**, not rows turned into flex boxes, so a screen reader
 *   still reads a grid with its headings; the days are `button`s the library
 *   moves the focus between (arrows by day or week, Page Up and Page Down by
 *   month, Home and End by week).
 * - **Compact on a fine pointer, 44 px high on a coarse one**, like every
 *   control of the panel; the days share the width of the box, so the box
 *   decides how wide a day is.
 * - **Selected and today are told by more than a colour.** The chosen day is
 *   filled, today is bold with a bar under its number, and in forced colours
 *   the filled day takes the system's highlight and today is outlined.
 * - **The focus ring is outside the cell** (an outline 2 px away, like every
 *   control of the panel), so it is painted on the sidebar and never on the
 *   fill of the chosen day; the box keeps 4 px around the grid so the ring of
 *   the first column and the first row is not cut.
 * - **Right to left.** The page's direction is read (`useDirection`) so the
 *   arrows move the way they point, and the month arrows are mirrored.
 *
 * What the library cannot know is the caller's: the zone, the language, the
 * texts. `today` and `month` are given, so the first paint does not read the
 * clock of the runtime that draws it.
 */
export function Calendar({
	className,
	classNames,
	components,
	...props
}: ComponentProps<typeof DayPicker>) {
	const dir = useDirection();
	const defaults = useMemo(() => getDefaultClassNames(), []);

	return (
		<DayPicker
			dir={dir}
			className={cn("w-full", className)}
			classNames={{
				root: cn("w-full p-1 text-sm", defaults.root),
				months: cn("relative flex w-full flex-col", defaults.months),
				month: cn("flex w-full flex-col gap-1", defaults.month),
				nav: cn(
					"absolute inset-x-0 top-0 flex w-full items-center justify-between",
					defaults.nav,
				),
				button_previous: cn(NAV_BUTTON, defaults.button_previous),
				button_next: cn(NAV_BUTTON, defaults.button_next),
				month_caption: cn(
					"flex h-8 w-full items-center justify-center px-8 pointer-coarse:h-11",
					defaults.month_caption,
				),
				caption_label: cn(
					"truncate font-medium text-sm select-none",
					defaults.caption_label,
				),
				month_grid: cn(
					"w-full table-fixed border-collapse",
					defaults.month_grid,
				),
				weekday: cn(
					"h-8 p-0 text-center font-normal text-muted-foreground text-xs select-none",
					defaults.weekday,
				),
				week: cn("h-8 pointer-coarse:h-11", defaults.week),
				day: cn("p-0 text-center", defaults.day),
				day_button: cn(DAY_BUTTON, defaults.day_button),
				today: cn("font-semibold", defaults.today),
				selected: cn(defaults.selected),
				outside: cn("opacity-60", defaults.outside),
				disabled: cn("opacity-40", defaults.disabled),
				hidden: cn("invisible", defaults.hidden),
				...classNames,
			}}
			components={{
				Chevron: CalendarChevron,
				DayButton: CalendarDayButton,
				...components,
			}}
			{...props}
		/>
	);
}

/** The arrow of a month: a 32 px square, 44 px on a coarse pointer, the look of a ghost button. */
const NAV_BUTTON = cn(
	"relative inline-flex size-8 items-center justify-center rounded-lg p-0 select-none pointer-coarse:size-11",
	"hover:bg-sidebar-accent-hover hover:text-sidebar-accent-foreground active:bg-sidebar-accent-press",
	"focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring",
	"aria-disabled:pointer-events-none aria-disabled:opacity-40 [&_svg]:size-4",
	FORCED_POINTER,
);

/**
 * A day: the whole cell, so the cell is the target. The styles read what the
 * button says of itself (`aria-current` on today, `data-selected` on the
 * chosen day), not a class of the library's, so the look and what a screen
 * reader is told cannot drift apart.
 */
const DAY_BUTTON = cn(
	"relative flex h-8 w-full items-center justify-center rounded-lg text-sm tabular-nums select-none pointer-coarse:h-11",
	"hover:bg-sidebar-accent-hover hover:text-sidebar-accent-foreground active:bg-sidebar-accent-press",
	"focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring",
	"data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground data-[selected=true]:hover:bg-primary-hover data-[selected=true]:active:bg-primary-press",
	"aria-[current=date]:after:absolute aria-[current=date]:after:bottom-1 aria-[current=date]:after:h-0.5 aria-[current=date]:after:w-3 aria-[current=date]:after:rounded-full aria-[current=date]:after:bg-current",
	"forced-colors:data-[selected=true]:bg-[Highlight] forced-colors:data-[selected=true]:text-[HighlightText] forced-colors:data-[selected=true]:hover:bg-[Highlight] forced-colors:data-[selected=true]:hover:text-[HighlightText] forced-colors:data-[selected=true]:active:bg-[Highlight] forced-colors:data-[selected=true]:active:text-[HighlightText]",
	"forced-colors:aria-[current=date]:after:bg-[CanvasText] forced-colors:data-[selected=true]:aria-[current=date]:after:bg-[HighlightText]",
	"forced-colors:outline-[color:Highlight] forced-colors:hover:outline-2 forced-colors:hover:-outline-offset-2 forced-colors:active:outline-4 forced-colors:active:-outline-offset-4",
);

/**
 * The library's own day button, which moves the focus onto itself when the
 * arrow keys give it the focus, with what the styles read added: today is
 * `aria-current="date"` and the chosen day is `data-selected`.
 */
function CalendarDayButton({
	day: _day,
	modifiers,
	className,
	...props
}: ComponentProps<typeof DayButton>) {
	const ref = useRef<HTMLButtonElement>(null);
	useEffect(() => {
		if (modifiers["focused"]) {
			ref.current?.focus();
		}
	}, [modifiers["focused"]]);
	return (
		<button
			ref={ref}
			className={cn("select-none", className)}
			aria-current={modifiers["today"] ? "date" : undefined}
			data-selected={modifiers["selected"] ? "true" : undefined}
			{...props}
		/>
	);
}

/** The arrow of a month, mirrored when the page reads from the right. */
function CalendarChevron({ orientation }: ComponentProps<typeof Chevron>) {
	const Icon = orientation === "right" ? ChevronRightIcon : ChevronLeftIcon;
	return <Icon aria-hidden="true" className="rtl:rotate-180" />;
}
