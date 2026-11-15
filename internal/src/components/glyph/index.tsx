import type * as React from "react";

import { cn } from "@/lib/class-names";

/**
 * The small drawings of the definition pass, by name: the icon of a page, of a
 * counter and of a state. Each is a file in `styles/glyphs/` worn as a mask by
 * a class of `styles/glyphs.css`; the table gives the class in full, so
 * Tailwind and a search for it both find it.
 */
const GLYPHS = {
	"layout-dashboard": "glyph-layout-dashboard",
	globe: "glyph-globe",
	users: "glyph-users",
	inbox: "glyph-inbox",
	history: "glyph-history",
	ban: "glyph-ban",
	tag: "glyph-tag",
	send: "glyph-send",
	clock: "glyph-clock",
	"circle-check": "glyph-circle-check",
	"circle-x": "glyph-circle-x",
	"circle-minus": "glyph-circle-minus",
	"power-off": "glyph-power-off",
	cloud: "glyph-cloud",
	"file-text": "glyph-file-text",
} as const;

export type GlyphName = keyof typeof GLYPHS;

/** The names, in the order of the table above. */
export const GLYPH_NAMES = Object.keys(GLYPHS) as GlyphName[];

/**
 * One drawing, as an empty `span` painted with the text colour of its parent
 * through a mask. An icon from the icon set is an `svg` with children, which a
 * streamed part cannot carry safely (`docs/maintainers/charts.md`); this is no
 * markup with children at all, so a server chart, a streamed counter and a
 * table cell can wear it alike. It is decoration: hidden from assistive
 * technology, and what it stands for is always said in words beside it.
 *
 * It stays in forced colours, painted in the system text colour
 * (`CanvasText`, with `forced-color-adjust-none` so the browser leaves the
 * paint alone): painted in the token's own colour it could meet a dark
 * canvas in a dark colour. A badge's icon is half of what tells its state
 * without a tone.
 */
export function Glyph({
	name,
	className,
	...props
}: { name: GlyphName } & Omit<React.ComponentProps<"span">, "children">) {
	return (
		<span
			data-slot="glyph"
			data-glyph={name}
			aria-hidden="true"
			className={cn(
				"glyph block size-4 shrink-0 forced-color-adjust-none bg-current forced-colors:bg-[CanvasText]",
				GLYPHS[name],
				className,
			)}
			{...props}
		/>
	);
}
