import { expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { contrastRatio, parseColor } from "@/test/luminance";

const css = readFileSync(
	new URL("../../../../styles/theme.css", import.meta.url),
	"utf8",
);
const selectors = [
	":root",
	':root:where(:not([data-theme="light"]))',
	':root:where([data-theme="dark"])',
];
const themes = selectors.map((selector) => {
	const start = css.indexOf(`${selector} {`);
	const body = css.slice(
		css.indexOf("{", start) + 1,
		css.indexOf("}", start),
	);
	return new Map(
		[...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [
			m[1] ?? "",
			m[2] ?? "",
		]),
	);
});

// Machado et al. full-severity linear-sRGB matrices, also used by the chart
// palette's documented measurements. Clamp to the display gamut before Lab.
const simulations = {
	protanopia: [
		[0.152286, 1.052583, -0.204868],
		[0.114503, 0.786281, 0.099216],
		[-0.003882, -0.048116, 1.051998],
	],
	deuteranopia: [
		[0.367322, 0.860646, -0.227968],
		[0.280085, 0.672501, 0.047413],
		[-0.01182, 0.04294, 0.968881],
	],
	tritanopia: [
		[1.255528, -0.076749, -0.178779],
		[-0.078411, 0.930809, 0.147602],
		[0.004733, 0.691367, 0.3039],
	],
};

/** D65 CIELAB from a simulated colour in linear sRGB; Euclidean delta E 76. */
function lab(color: string, matrix: number[][]): number[] {
	const rgb = parseColor(color)
		.map((c) => c / 255)
		.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
	const [r = 0, g = 0, b = 0] = matrix.map((row) =>
		Math.min(
			1,
			Math.max(
				0,
				row.reduce((sum, c, n) => sum + c * (rgb[n] ?? 0), 0),
			),
		),
	);
	const f = (t: number) =>
		t > (6 / 29) ** 3 ? Math.cbrt(t) : t / (3 * (6 / 29) ** 2) + 4 / 29;
	const x = f((0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047);
	const y = f(0.2126729 * r + 0.7151522 * g + 0.072175 * b);
	const z = f((0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883);
	return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

it("gives all eight text-on-chip pairs WCAG AA contrast in both themes", () => {
	for (const theme of themes) {
		for (let n = 1; n <= 8; n++) {
			const text = theme.get(`--label-${n}`) ?? "";
			const chip = theme.get(`--label-${n}-chip`) ?? "";
			expect([n, contrastRatio(text, chip) >= 4.5]).toEqual([n, true]);
			expect(css).toContain(
				`--color-label-${n}-chip: var(--label-${n}-chip);`,
			);
		}
	}
});

for (const [vision, matrix] of Object.entries(simulations)) {
	it(`separates all 28 pairs under ${vision} in both themes`, () => {
		for (const theme of themes) {
			const colors = Array.from({ length: 8 }, (_, n) =>
				lab(theme.get(`--label-${n + 1}`) ?? "", matrix),
			);
			for (const [i, a] of colors.entries()) {
				for (const [j, b] of colors.entries()) {
					if (j <= i) continue;
					const distance = Math.hypot(
						...a.map((v, n) => v - (b[n] ?? 0)),
					);
					// 10 delta E 76: clearly above the ~2.3 just-noticeable difference.
					expect([i + 1, j + 1, distance >= 10]).toEqual([
						i + 1,
						j + 1,
						true,
					]);
				}
			}
		}
	});
}
