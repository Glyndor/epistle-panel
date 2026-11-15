import { cn } from "@/lib/class-names";
import { MARK_POINTER } from "@/lib/pointer-states";

/**
 * One mark of a chart: a bar, a part of a bar, a part of a column. It is an
 * `svg` element with nothing inside, as wide and as high as its `width` and
 * `height` attributes say and painted by a class.
 *
 * Why an `svg`, and why empty. The panel's policy refuses a `style` attribute,
 * so the size of a mark cannot be a style; `svg` is an element whose box takes
 * its size from attributes. And it has no child on purpose: when React streams
 * a page it can cut the markup at any element and send the rest later in a
 * hidden holder, and the holder it uses for the children of an `svg` is
 * `<svg style="display:none">`, an inline style the policy refuses. That was
 * measured on the built server with this page: a chart drawn with `rect`
 * children logged the violation on some requests and not on others. An `svg`
 * with no child cannot be cut inside, so the holder is always the plain
 * `<div hidden>`. Where a mark sits is the layout's job (flex), not the
 * mark's.
 *
 * A mark keeps its colour when the reader's system forces colours (a high
 * contrast theme): a background is one of the things such a theme repaints,
 * and a chart whose marks took the page's colour would be blank.
 *
 * Under the pointer a mark is ringed by an outline in the ring colour of the
 * theme (`MARK_POINTER`), one pixel while the pointer is on it and two while it
 * is pressed, with the mark lifted over its neighbours so the ring is not
 * covered by the next one. The mark itself is never recoloured: a series
 * colour is held at 3:1 against the card, and any fade or brightening of it would break that in one
 * of the two themes. An outline is also what a forced-colours theme keeps.
 */
export function Mark({
	width,
	height,
	className,
	...props
}: {
	/** Pixels as a number, or a percentage of the room around it as a string. */
	width: number | string;
	/** Pixels. */
	height: number;
	className?: string | undefined;
} & Record<`data-${string}`, string | number>) {
	return (
		<svg
			data-slot="chart-mark"
			width={width}
			height={height}
			aria-hidden="true"
			focusable="false"
			className={cn(
				"relative block shrink-0 forced-color-adjust-none hover:z-10",
				MARK_POINTER,
				className,
			)}
			{...props}
		/>
	);
}
