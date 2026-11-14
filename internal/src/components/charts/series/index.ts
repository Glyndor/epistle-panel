/**
 * The class that paints a mark, or the swatch that names it in a legend, in
 * each series colour of the palette, in its fixed order. The colours are the
 * `--chart-1` to `--chart-5` tokens of the theme, so an operator's stylesheet
 * restyles every chart at once. The class names are spelled out because
 * Tailwind only emits a class it finds whole in a source file.
 */
export const SERIES = [
	"bg-chart-1",
	"bg-chart-2",
	"bg-chart-3",
	"bg-chart-4",
	"bg-chart-5",
] as const;

/** A series of the palette, by its place in the fixed order. */
export type SeriesIndex = 0 | 1 | 2 | 3 | 4;

/**
 * A number as an SVG percentage, to three decimals at most: `12.5%`. The width
 * of a mark is a percentage of the room it has, so a chart follows the width
 * of its card with no script.
 */
export function percent(value: number): string {
	return `${Number(value.toFixed(3))}%`;
}
