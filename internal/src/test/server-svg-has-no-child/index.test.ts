import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = join(import.meta.dir, "..", "..");

/** The folders whose components draw the charts, all of them on the server. */
const CHART_FOLDERS = ["components/charts/", "features/overview/"];

/**
 * What a chart file rendered on the server must not hold, each with what to do
 * instead. React can cut a streamed page at any element and send the rest
 * later in a hidden holder; the holder for the children of an `svg` is
 * `<svg style="display:none">`, an inline style the panel's policy refuses
 * (measured on the built server, see `components/charts/mark`). So nothing a
 * chart renders on the server may be a child of an `svg`.
 */
const REFUSED: ReadonlyArray<readonly [RegExp, string]> = [
	[
		/<\/svg>/,
		"an svg with children: draw the mark with Mark (components/charts/mark), which has none",
	],
	[
		/<(rect|path|circle|ellipse|line|polyline|polygon|g|text|tspan|defs|use|clipPath|mask|pattern)[\s/>]/,
		"an svg child element: draw the mark with Mark (components/charts/mark)",
	],
	[
		/from "lucide-react"/,
		"an icon, which is an svg with children: use words, or a client component",
	],
	[
		/dangerouslySetInnerHTML/,
		"markup set as a string: the charts need none, a Mark is an empty svg",
	],
];

/** The source with comments taken out, so a sentence that names an element is not a use of it. */
function code(source: string): string {
	return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/** What `source` holds that a chart file rendered on the server must not; a client component is not checked. */
function refusedIn(source: string): string[] {
	const text = code(source);
	if (/^\s*"use client";/.test(text)) {
		return [];
	}
	return REFUSED.filter(([pattern]) => pattern.test(text)).map(
		([, instead]) => instead,
	);
}

function chartFiles(): string[] {
	return Array.from(new Bun.Glob("**/*.tsx").scanSync(SRC))
		.filter(
			(file) =>
				CHART_FOLDERS.some((folder) => file.startsWith(folder)) &&
				!file.includes("/test-support/") &&
				!file.endsWith(".test.tsx"),
		)
		.sort();
}

describe("a chart rendered on the server puts nothing inside an svg", () => {
	it("finds the chart files", () => {
		const files = chartFiles();

		expect(files).toContain("components/charts/mark/index.tsx");
		expect(files).toContain(
			"features/overview/components/timeline-card/index.tsx",
		);
		expect(files.length).toBeGreaterThan(10);
	});

	it("no chart file draws an svg child, an icon or markup from a string", () => {
		const found: string[] = [];
		for (const file of chartFiles()) {
			for (const instead of refusedIn(
				readFileSync(join(SRC, file), "utf8"),
			)) {
				found.push(`${file}: ${instead}`);
			}
		}

		expect(found).toEqual([]);
	});

	it("the check itself sees each thing it refuses", () => {
		expect(refusedIn('<svg width="10"><rect x="0" /></svg>')).toHaveLength(
			2,
		);
		expect(refusedIn("<svg>\n</svg>")).toHaveLength(1);
		expect(refusedIn("<g>{bars}</g>")).toHaveLength(1);
		expect(
			refusedIn('import { ArrowRightIcon } from "lucide-react";'),
		).toHaveLength(1);
		expect(
			refusedIn("<svg dangerouslySetInnerHTML={{ __html: marks }} />"),
		).toHaveLength(1);
	});

	it("lets an empty svg, a sentence about svg and a client component through", () => {
		expect(refusedIn('<svg width="10%" height={8} />')).toEqual([]);
		expect(
			refusedIn("/** Not <svg><rect /></svg>, see Mark. */\nexport {};"),
		).toEqual([]);
		expect(
			refusedIn('"use client";\nimport { XIcon } from "lucide-react";'),
		).toEqual([]);
	});
});
