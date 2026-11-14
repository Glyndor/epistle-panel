"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/class-names";

/** How much of the strip, in pixels, has to be out of view at an end for that end to say so. */
const HIDDEN = 0.5;

/** Whether the keyboard put the focus there. An engine without the selector is taken as "yes". */
function focusIsVisible(element: Element): boolean {
	try {
		return element.matches(":focus-visible");
	} catch {
		return true;
	}
}

/** Which ends of the strip hold filters that are out of view. */
interface More {
	readonly start: boolean;
	readonly end: boolean;
}

/**
 * The way to what is out of view at one end of the strip, for a pointer: a
 * chevron over that end, on the pane's surface fading into the strip, so the
 * filter under it reads as cut and not as missing. It is not in the tab order
 * nor in the accessibility tree: the keyboard reaches every filter by Tab,
 * which brings it into view, and a screen reader lists them all.
 */
function Edge({ side, onPress }: { side: keyof More; onPress: () => void }) {
	const Icon = side === "start" ? ChevronLeftIcon : ChevronRightIcon;
	return (
		<Button
			type="button"
			variant="ghost"
			size="sm"
			tabIndex={-1}
			aria-hidden="true"
			data-edge={side}
			// A press must not take the focus onto a control nobody is told
			// about: it stays where it was.
			onMouseDown={(event) => event.preventDefault()}
			onClick={onPress}
			className={cn(
				"group/edge absolute inset-y-0 min-h-0 w-10 rounded-none from-50% from-surface to-transparent px-0 hover:bg-transparent active:bg-transparent pointer-coarse:min-h-0 pointer-coarse:px-0",
				side === "start"
					? "start-0 justify-start bg-linear-to-r rtl:bg-linear-to-l"
					: "end-0 justify-end bg-linear-to-l rtl:bg-linear-to-r",
			)}
		>
			<span className="flex size-6 items-center justify-center rounded-full bg-muted group-hover/edge:bg-foreground/15 group-active/edge:bg-foreground/20">
				<Icon className="size-4 rtl:rotate-180" />
			</span>
		</Button>
	);
}

/**
 * The filters of the list on one line, whatever the language and the width.
 * They never wrap: a second line pushed the list down by its height, away
 * from the place its skeleton held. What does not fit is out of view at an
 * end and is reached three ways:
 *
 * - by the keyboard: a filter that takes the focus from a key is brought into
 *   view, whole and clear of the chevrons, with room for its ring (a browser
 *   does not do it by itself for a link cut by this box: measured,
 *   `scrollLeft` stayed 0);
 * - by a pointer: a chevron at the end that holds more moves the strip, and
 *   says there is more;
 * - by touch or a wheel, which move the strip as any scrolling box.
 *
 * The chevrons come once the page runs its script, from the strip's own
 * measure, and follow its scroll and its size.
 */
export function FilterStrip({
	label,
	children,
}: {
	/** The name of the navigation, already translated. */
	label: string;
	/** The filters, each a list item. */
	children: ReactNode;
}) {
	const strip = useRef<HTMLUListElement>(null);
	const [more, setMore] = useState<More>({ start: false, end: false });

	useEffect(() => {
		const list = strip.current;
		if (list === null) {
			return;
		}
		const read = () => {
			const hidden = list.scrollWidth - list.clientWidth;
			// Negative in a right-to-left page: the distance is what counts.
			const moved = Math.abs(list.scrollLeft);
			// Any part of a filter out of view counts, down to a pixel: half
			// a pixel is the most the rounded sizes can be off by.
			const next = {
				start: moved > HIDDEN,
				end: hidden - moved > HIDDEN,
			};
			setMore((now) =>
				now.start === next.start && now.end === next.end ? now : next,
			);
		};
		read();
		list.addEventListener("scroll", read, { passive: true });
		const observer =
			typeof ResizeObserver === "undefined"
				? null
				: new ResizeObserver(read);
		observer?.observe(list);
		return () => {
			list.removeEventListener("scroll", read);
			observer?.disconnect();
		};
	}, []);

	const move = (toward: 1 | -1) => {
		const list = strip.current;
		if (list === null) {
			return;
		}
		const forward = getComputedStyle(list).direction === "rtl" ? -1 : 1;
		list.scrollBy({ left: toward * forward * list.clientWidth * 0.75 });
	};

	return (
		<nav aria-label={label} data-slot="filter-strip" className="relative">
			<ul
				ref={strip}
				onFocus={(event) => {
					// Only for the keyboard. A press gives the focus on its
					// way down: moving the strip then would put another
					// filter under the pointer before it comes up, and the
					// press would follow no link.
					if (focusIsVisible(event.target)) {
						event.target.scrollIntoView({
							block: "nearest",
							inline: "nearest",
						});
					}
				}}
				className="-m-1 flex scroll-px-11 gap-1 overflow-x-auto p-1 [scrollbar-width:none]"
			>
				{children}
			</ul>
			{more.start ? <Edge side="start" onPress={() => move(-1)} /> : null}
			{more.end ? <Edge side="end" onPress={() => move(1)} /> : null}
		</nav>
	);
}
