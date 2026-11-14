import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { contrastRatio } from "@/test/luminance";

/**
 * The theme file is CSS, which no compiler checks for the three things the
 * theme choice depends on: the dark values exist twice and must be the same
 * list, every rule that reads the choice must weigh no more than a plain
 * `:root` (or an operator's stylesheet stops overriding it), and the browser
 * is told the scheme for each choice.
 */
const css = readFileSync(join(import.meta.dir, "theme.css"), "utf8").replace(
	/\/\*[\s\S]*?\*\//g,
	"",
);

/**
 * The declarations of the first rule whose selector is exactly `selector`;
 * none when the file has no such rule, so a test that reads them fails on its
 * own assertion.
 */
function declarations(selector: string): Map<string, string> {
	const start = css.indexOf(`${selector} {`);
	if (start === -1) {
		return new Map();
	}
	const open = css.indexOf("{", start);
	const body = css.slice(open + 1, css.indexOf("}", open));
	const out = new Map<string, string>();
	for (const line of body.split(";")) {
		const colon = line.indexOf(":");
		if (colon !== -1) {
			out.set(
				line.slice(0, colon).trim(),
				line
					.slice(colon + 1)
					.trim()
					.replace(/\s+/g, " "),
			);
		}
	}
	return out;
}

const light = declarations(":root");
const preferredDark = declarations(':root:where(:not([data-theme="light"]))');
const chosenDark = declarations(':root:where([data-theme="dark"])');
const chosenLight = declarations(':root:where([data-theme="light"])');

describe("theme.css", () => {
	it("holds the same dark values for a browser that prefers dark and for the chosen dark theme", () => {
		const chosen = new Map(chosenDark);
		chosen.delete("color-scheme");

		expect(preferredDark.size).toBeGreaterThan(20);
		expect([...chosen.entries()]).toEqual([...preferredDark.entries()]);
	});

	it("gives the five chart colours a light value and one dark value, whichever way dark is reached", () => {
		// A chart colour missing from the chosen dark list would draw the light
		// palette on a dark card for whoever picked the dark theme by hand.
		const dark = ["#3987e5", "#c98500", "#d5414b", "#995ba6", "#34a08e"];
		const lightValues = [
			"#2a78d6",
			"#bb731b",
			"#a51d2b",
			"#732a9d",
			"#0e8f7a",
		];
		for (const [index, value] of dark.entries()) {
			const name = `--chart-${index + 1}`;
			expect(light.get(name)).toBe(lightValues[index] ?? "");
			expect(preferredDark.get(name)).toBe(value);
			expect(chosenDark.get(name)).toBe(value);
		}
	});

	it("gives the band of missing data a light value and one dark value, whichever way dark is reached", () => {
		// The band is a mark the reader must see, 3:1 against the card: a dark
		// list without it would draw the light grey on a dark card, or none.
		expect(light.get("--chart-missing")).toBe("#85858d");
		expect(preferredDark.get("--chart-missing")).toBe("#6e6e76");
		expect(chosenDark.get("--chart-missing")).toBe("#6e6e76");
		expect(css).toContain("--color-chart-missing: var(--chart-missing);");
	});

	it("gives the bar of the shell a light value and one dark value, whichever way dark is reached", () => {
		expect(light.get("--header")).toBe("#ffffff");
		expect(preferredDark.get("--header")).toBe("oklch(0.255 0.006 286)");
		expect(chosenDark.get("--header")).toBe("oklch(0.255 0.006 286)");
		expect(css).toContain("--color-header: var(--header);");
	});

	it("keeps the rail, the bar and the canvas apart in luminance in every list", () => {
		// The shell draws no line between its zones: tone is all that tells
		// them apart, so two zones that drift to the same tone become one.
		const zones = ["--sidebar", "--header", "--background"] as const;
		for (const [list, values] of [
			["light", light],
			["preferred dark", preferredDark],
			["chosen dark", chosenDark],
		] as const) {
			for (const [index, first] of zones.entries()) {
				for (const second of zones.slice(index + 1)) {
					const ratio = contrastRatio(
						values.get(first) ?? "",
						values.get(second) ?? "",
					);
					expect([list, first, second, ratio >= 1.1]).toEqual([
						list,
						first,
						second,
						true,
					]);
				}
			}
		}
	});

	it("lifts a work panel off the canvas in every list", () => {
		for (const values of [light, preferredDark, chosenDark]) {
			expect(
				contrastRatio(
					values.get("--surface") ?? "",
					values.get("--background") ?? "",
				),
			).toBeGreaterThan(1.08);
		}
	});

	it("gives every dark value a light one to replace", () => {
		for (const name of preferredDark.keys()) {
			expect(light.has(name)).toBe(true);
		}
	});

	it("applies the preferred dark values only inside the dark media query", () => {
		const media = css.indexOf("@media (prefers-color-scheme: dark)");
		const rule = css.indexOf(':root:where(:not([data-theme="light"]))');

		expect(media).toBeGreaterThan(-1);
		expect(rule).toBeGreaterThan(media);
		// One media query, and the rule is the only thing in it.
		expect(css.split("@media").length - 1).toBe(1);
		expect(
			css
				.slice(media, rule)
				.replace("@media (prefers-color-scheme: dark)", "")
				.trim(),
		).toBe("{");
	});

	it("tells the browser the scheme of each choice", () => {
		expect(light.get("color-scheme")).toBe("light dark");
		expect([...chosenLight.entries()]).toEqual([["color-scheme", "light"]]);
		expect(chosenDark.get("color-scheme")).toBe("dark");
	});

	it("reads the theme attribute only inside :where(), so an operator's :root still wins", () => {
		// Every selector of the file: what stands before a `{`, at-rules aside.
		const selectors = [...css.matchAll(/(?:^|[{}])\s*([^{}@]+?)\s*\{/g)]
			.map((match) => match[1] ?? "")
			.filter((selector) => !selector.startsWith("--"));
		const themed = selectors.filter((selector) =>
			selector.includes("data-theme"),
		);

		expect(themed.sort()).toEqual([
			':root:where(:not([data-theme="light"]))',
			':root:where([data-theme="dark"])',
			':root:where([data-theme="light"])',
		]);
		// `:where()` weighs nothing: with it removed, each is a plain `:root`.
		for (const selector of selectors.filter((s) => s.startsWith(":root"))) {
			expect(selector.replace(/:where\(.*\)$/, "")).toBe(":root");
		}
		// And the attribute appears nowhere else, in a selector or a value.
		expect(css.split("data-theme").length - 1).toBe(3);
	});

	it("puts the chosen themes after the light values, so they replace them at equal weight", () => {
		const root = css.indexOf(":root {");

		expect(css.indexOf(':root:where([data-theme="dark"])')).toBeGreaterThan(
			root,
		);
		expect(
			css.indexOf(':root:where([data-theme="light"])'),
		).toBeGreaterThan(root);
	});
});
