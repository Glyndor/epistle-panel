"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";

import { Edge } from "@/features/mail/components/filter-strip/edge";

/**
 * How much of a filter, in pixels, has to be out of view at an end for that
 * end to show its chevron. Under it the filter at that end reads whole (its
 * side padding is 10 px or more), and a chevron over it only took its press.
 */
const HIDDEN = 8;

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
 * Which ends of the strip hold filters that are out of view. The filters are
 * measured where they are drawn, and not the box that clips them: the box
 * hides its own padding as well, and that is not a filter hidden.
 */
function hiddenEnds(list: HTMLElement): More {
	const first = list.firstElementChild;
	const last = list.lastElementChild;
	if (first === null || last === null) {
		return { start: false, end: false };
	}
	const box = list.getBoundingClientRect();
	const a = first.getBoundingClientRect();
	const b = last.getBoundingClientRect();
	// A right-to-left page reads the other way: its start is on the right.
	const rtl = getComputedStyle(list).direction === "rtl";
	return rtl
		? {
				start: a.right - box.right > HIDDEN,
				end: box.left - b.left > HIDDEN,
			}
		: {
				start: box.left - a.left > HIDDEN,
				end: b.right - box.right > HIDDEN,
			};
}

/**
 * The filters of the list on one line, whatever the language and the width.
 * They never wrap: a second line pushed the list down by its height, away
 * from the place its skeleton held. What does not fit is out of view at an
 * end and is reached three ways:
 *
 * - by the keyboard: a filter that takes the focus from a key is brought into
 *   view, whole, with room for its ring on both sides (a browser does not do
 *   it by itself for a link cut by this box: measured, `scrollLeft` stayed
 *   0). The chevrons are not drawn meanwhile, see `Edge`;
 * - by a pointer: a chevron at the end that holds more moves the strip, and
 *   says there is more;
 * - by touch or a wheel, which move the strip as any scrolling box.
 *
 * The chevrons come once the page runs its script, from the strip's own
 * measure. It is read again when the strip scrolls, when its box or the box
 * of any filter changes size (the filter in use is heavier, and wider) and
 * when the page's fonts have loaded: the content gets wider without the
 * strip's own box changing, and an end that then held more said nothing.
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
		let mounted = true;
		const read = () => {
			if (!mounted) {
				return;
			}
			const next = hiddenEnds(list);
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
		for (const filter of list.children) {
			observer?.observe(filter);
		}
		// Not every engine nor the test DOM has it.
		void document.fonts?.ready.then(read);
		return () => {
			mounted = false;
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
		<nav
			aria-label={label}
			data-slot="filter-strip"
			className="group/strip relative"
		>
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
				// The scroll padding is the room of a focus ring and a
				// little more: 2 px of offset and 2 px of line.
				className="-m-1 flex scroll-px-2 gap-1 overflow-x-auto p-1 [scrollbar-width:none]"
			>
				{children}
			</ul>
			{more.start ? <Edge side="start" onPress={() => move(-1)} /> : null}
			{more.end ? <Edge side="end" onPress={() => move(1)} /> : null}
		</nav>
	);
}
