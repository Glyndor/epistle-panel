import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { contrastOfRgb, mixInOklab, parseColor } from "@/test/luminance";

/**
 * The fills a control takes under the pointer that `theme.css` derives from the
 * roles (`--color-accent-press` and its kin) are `color-mix()` values, which
 * no compiler checks. Each one is read from the file, evaluated in OKLab for
 * the light list and for the dark one, and held to the two things the panel
 * promised: a step from the state before it that the eye sees, and the words
 * that sit on it at 4.5:1.
 */
const css = readFileSync(join(import.meta.dir, "theme.css"), "utf8").replace(
	/\/\*[\s\S]*?\*\//g,
	"",
);

/** The `--name: value` pairs of the first rule whose selector is `selector`. */
function list(selector: string): Map<string, string> {
	const open = css.indexOf("{", css.indexOf(`${selector} {`));
	const body = css.slice(open + 1, css.indexOf("}", open));
	const out = new Map<string, string>();
	for (const line of body.split(";")) {
		const match = /^\s*(--[\w-]+)\s*:\s*([\s\S]+?)\s*$/.exec(line);
		if (match?.[1] && match[2]) {
			out.set(match[1], match[2].replace(/\s+/g, " "));
		}
	}
	return out;
}

const lists = {
	light: list(":root"),
	dark: list(':root:where([data-theme="dark"])'),
} as const;

/** `--color-<name>`: the role it mixes into, the colour it mixes in and the share. */
function derived(name: string) {
	const hit = [
		...css.matchAll(
			/--color-([\w-]+):\s*color-mix\(in oklab,\s*var\(--([\w-]+)\),\s*var\(--([\w-]+)\)\s*([\d.]+)%\)/g,
		),
	].find((entry) => entry[1] === name);
	if (!hit) {
		throw new Error(`--color-${name} is not a color-mix of two roles`);
	}
	return { base: hit[2] ?? "", into: hit[3] ?? "", share: Number(hit[4]) };
}

function role(theme: keyof typeof lists, name: string): string {
	const value = lists[theme].get(`--${name}`);
	if (value === undefined) {
		throw new Error(`--${name} is not in the ${theme} list`);
	}
	return value;
}

/** What the derived token paints in a theme. */
function paint(theme: keyof typeof lists, name: string) {
	const { base, into, share } = derived(name);
	return mixInOklab(role(theme, base), role(theme, into), share);
}

/** The state before a derived fill, and the text that sits on it. */
const FILLS = [
	{ name: "accent-press", before: "accent", text: "accent-foreground" },
	{
		name: "secondary-hover",
		before: "secondary",
		text: "secondary-foreground",
	},
	{
		name: "secondary-press",
		before: "secondary-hover",
		text: "secondary-foreground",
	},
	{
		name: "sidebar-accent-hover",
		before: "sidebar-accent",
		text: "sidebar-accent-foreground",
	},
	{
		name: "sidebar-accent-press",
		before: "sidebar-accent-hover",
		text: "sidebar-accent-foreground",
	},
	{
		name: "destructive-press",
		before: "destructive-soft",
		text: "destructive",
	},
] as const;

const DERIVED = new Set<string>(FILLS.map((fill) => fill.name));

/** A role of the theme, or one of the derived fills, as the browser paints it. */
function colour(theme: keyof typeof lists, name: string) {
	return DERIVED.has(name)
		? paint(theme, name)
		: parseColor(role(theme, name));
}

describe("the pointer fills derived in theme.css", () => {
	for (const theme of ["light", "dark"] as const) {
		for (const fill of FILLS) {
			it(`${fill.name} is a visible step from ${fill.before} in the ${theme} theme`, () => {
				const step = contrastOfRgb(
					colour(theme, fill.name),
					colour(theme, fill.before),
				);

				// 1.1:1 is the step the rows of a table already take on hover
				// over the page canvas, and the least the eye reads as a change.
				expect(step).toBeGreaterThanOrEqual(1.1);
			});

			it(`${fill.name} keeps ${fill.text} at 4.5:1 in the ${theme} theme`, () => {
				expect(
					contrastOfRgb(
						colour(theme, fill.name),
						colour(theme, fill.text),
					),
				).toBeGreaterThanOrEqual(4.5);
			});
		}

		it(`the hover fill of a ghost control is told from every surface it sits on in the ${theme} theme`, () => {
			const hover = parseColor(role(theme, "accent"));
			for (const surface of ["background", "surface", "surface-sunken"]) {
				expect(
					contrastOfRgb(hover, parseColor(role(theme, surface))),
				).toBeGreaterThanOrEqual(1.1);
			}
		});

		it(`the foreground line a field takes on hover is 3:1 against the hover fill in the ${theme} theme`, () => {
			// The well alone moves five steps of 255 in the light theme (field
			// to accent), so the line carries the hover, and it has to be read
			// against the fill it now sits on.
			expect(
				contrastOfRgb(
					parseColor(role(theme, "foreground")),
					parseColor(role(theme, "accent")),
				),
			).toBeGreaterThanOrEqual(3);
		});
	}

	it("takes every derived fill from the roles, never from a palette value", () => {
		const names = [
			...css.matchAll(/--color-([\w-]+)-(?:hover|press):/g),
		].map((entry) => entry[0]);

		expect(names.length).toBeGreaterThanOrEqual(5);
		for (const fill of FILLS) {
			expect(css).toMatch(
				new RegExp(
					`--color-${fill.name}: color-mix\\(in oklab, var\\(--[\\w-]+\\), var\\(--[\\w-]+\\) \\d+%\\)`,
				),
			);
		}
	});
});
