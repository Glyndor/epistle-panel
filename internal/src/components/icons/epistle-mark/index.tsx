import type * as React from "react";

/**
 * The Epistle mark: a letter E in a rounded square, drawn on the 24 px grid
 * with the 2 px round stroke the Lucide set uses, so it sits beside Lucide icons
 * without a visible difference. It takes `currentColor` and is decorative.
 * Original artwork for this panel; there is no external source or licence.
 */
export function EpistleMark(props: React.ComponentProps<"svg">) {
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
			<rect width="18" height="18" x="3" y="3" rx="4" />
			<path d="M15 8H9v8h6" />
			<path d="M9 12h4" />
		</svg>
	);
}
