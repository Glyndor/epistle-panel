import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = join(import.meta.dir, "..", "..");

/**
 * An icon has one size and one stroke for the part it plays, so two entries of
 * the sidebar, two actions of a bar or two rows of a menu never differ by
 * their icon's weight. The size is set once, by the component that holds the
 * icon (16 px for an entry of the navigation, an action of a bar and a row of
 * a menu), and the stroke is the icon set's own (2 px on the 24 px grid).
 * `docs/maintainers/icons.md` has the table.
 */

const read = (file: string) => readFileSync(join(SRC, file), "utf8");

/** The source with comments taken out. */
function code(source: string): string {
	return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function productionFiles(): string[] {
	return Array.from(new Bun.Glob("**/*.tsx").scanSync(SRC))
		.filter(
			(file) =>
				!file.startsWith("test/") &&
				!file.includes("/test-support/") &&
				!file.endsWith(".test.tsx"),
		)
		.sort();
}

describe("an icon has one size and one stroke for its role", () => {
	it("no screen gives an icon a stroke of its own", () => {
		// The icons drawn for the panel state the set's stroke themselves.
		const drawnHere = "components/icons/";
		const found = productionFiles().filter(
			(file) =>
				!file.startsWith(drawnHere) &&
				/\b(absoluteStrokeWidth|strokeWidth)\b/.test(code(read(file))),
		);

		expect(found).toEqual([]);
	});

	it("an entry of the navigation, an action of a bar and a row of a menu size their icon at 16 px", () => {
		const holders: ReadonlyArray<readonly [string, string, number]> = [
			// The entries of the sidebar, in both areas.
			["components/ui/sidebar/menu/index.tsx", "[&>svg]:size-4", 1],
			// A button, which is every action of a bar: an icon that does not
			// name a size of its own gets this one.
			[
				"components/ui/button/index.tsx",
				"[&_svg:not([class*='size-'])]:size-4",
				1,
			],
			// A row of a menu (an action, a choice) and the heading of a run.
			["components/ui/dropdown-menu/index.tsx", "[&_svg]:size-4", 3],
		];
		for (const [file, sizing, times] of holders) {
			expect([file, code(read(file)).split(sizing).length - 1]).toEqual([
				file,
				times,
			]);
		}
	});

	it("no entry, action or row sizes its icon away from that", () => {
		// An icon inside one of those holders that carries a size class of its
		// own would escape the holder's. The smaller marks of the panel are
		// not icons of a control: the tick drawn inside a 16 px box, the
		// arrow that says how a column is sorted, and the marks of a
		// message's state in its row.
		const smaller: Readonly<Record<string, string>> = {
			"components/ui/dropdown-menu/index.tsx": "size-3",
			"components/data-table/header/index.tsx": "size-3.5",
			"features/mail/components/message-row/index.tsx": "size-3.5",
		};
		const found: string[] = [];
		for (const file of productionFiles()) {
			const sized = [
				...code(read(file)).matchAll(
					/<[A-Z]\w*Icon\b[^>]*?className="[^"]*\b(size-[\d.]+)\b/gs,
				),
			].map((match) => match[1] ?? "");
			for (const size of sized) {
				if (size !== "size-4" && smaller[file] !== size) {
					found.push(`${file}: ${size}`);
				}
			}
		}

		expect(found).toEqual([]);
	});
});
