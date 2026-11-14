import { cn } from "@/lib/class-names";

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
			className={cn("block shrink-0 forced-color-adjust-none", className)}
			{...props}
		/>
	);
}
