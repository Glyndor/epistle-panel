import type * as React from "react";

/**
 * The mark of a message its reader set as important: a tab with a point at one
 * end and a notch at the other, the shape mail clients use for it. Lucide has
 * no such mark that can be filled, and the list tells "important" from "not"
 * by the fill. It is drawn on the 24 px grid with the 2 px round stroke the
 * Lucide set uses, takes `currentColor` and is decorative. A caller fills it
 * with a class (`fill-current`). Original artwork for this panel; there is no
 * external source or licence.
 */
export function ImportantMark(props: React.ComponentProps<"svg">) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="24"
			height="24"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
			{...props}
		>
			<path d="M4 5h11l5 7-5 7H4l4.5-7z" />
		</svg>
	);
}
