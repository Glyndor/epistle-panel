/**
 * The luminance of a colour of the theme file, as a browser paints it: the
 * colour is brought to sRGB, rounded to the 8 bits of a channel, and weighed
 * with the WCAG formula. It reads the two spellings the theme uses, `#rrggbb`
 * and `oklch(L C H)`, and throws on anything else, so a test never compares a
 * value it could not read.
 */

type Rgb = readonly [number, number, number];

/** A channel in linear light, encoded for sRGB and rounded to 8 bits. */
function encode(linear: number): number {
	const value = Math.min(1, Math.max(0, linear));
	const encoded =
		value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055;
	return Math.round(encoded * 255);
}

/** `oklch(L C H)` as 8-bit sRGB, by the matrices of the OKLab definition. */
function oklchToRgb(lightness: number, chroma: number, hue: number): Rgb {
	const angle = (hue * Math.PI) / 180;
	const a = chroma * Math.cos(angle);
	const b = chroma * Math.sin(angle);
	const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
	const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
	const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
	return [
		encode(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
		encode(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
		encode(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
	];
}

/** A colour of the theme file as 8-bit sRGB. */
export function parseColor(value: string): Rgb {
	const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(
		value.trim(),
	);
	if (hex) {
		return [
			Number.parseInt(hex[1] ?? "", 16),
			Number.parseInt(hex[2] ?? "", 16),
			Number.parseInt(hex[3] ?? "", 16),
		];
	}
	const oklch = /^oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)$/.exec(value.trim());
	if (oklch) {
		return oklchToRgb(Number(oklch[1]), Number(oklch[2]), Number(oklch[3]));
	}
	throw new Error(`not a colour this helper reads: "${value}"`);
}

/** The relative luminance of an sRGB colour (WCAG 2.2). */
export function luminance([red, green, blue]: Rgb): number {
	const linear = (channel: number) => {
		const value = channel / 255;
		return value <= 0.04045
			? value / 12.92
			: ((value + 0.055) / 1.055) ** 2.4;
	};
	return (
		0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue)
	);
}

/** The contrast ratio of two colours of the theme file, from 1 (the same) to 21. */
export function contrastRatio(first: string, second: string): number {
	const [lighter, darker] = [
		luminance(parseColor(first)),
		luminance(parseColor(second)),
	].sort((a, b) => b - a) as [number, number];
	return (lighter + 0.05) / (darker + 0.05);
}
