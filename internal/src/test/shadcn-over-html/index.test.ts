import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = join(import.meta.dir, "..", "..");

/**
 * A control the panel has a component for is not written by hand. The
 * components live in `components/ui`, on the panel's tokens, sized for a fine
 * and a coarse pointer and measured against the policy; a hand-made one is none
 * of that. Each entry names the element and the component to use instead.
 */
const HAND_MADE: ReadonlyArray<readonly [RegExp, string]> = [
	[/<select[\s>]/, "NativeSelect (components/ui/native-select)"],
	[/<textarea[\s>]/, "Textarea (components/ui/textarea)"],
	[/<details[\s>]/, "Collapsible (components/ui/collapsible)"],
	[/<summary[\s>]/, "CollapsibleTrigger (components/ui/collapsible)"],
	[/<dialog[\s>]/, "Dialog, AlertDialog or Sheet (components/ui)"],
	[/<table[\s>]/, "Table (components/ui/table)"],
	[/<kbd[\s>]/, "Kbd (components/ui/kbd)"],
	[/type="radio"/, "RadioGroup (components/ui/radio-group)"],
	[
		/window\.confirm\(|[^.\w]confirm\(/,
		"ConfirmAction (components/confirm-action)",
	],
];

/**
 * Files still on a hand-made control, each with the reason. An entry leaves
 * this list when the file is changed; nothing is added to it.
 */
const KNOWN: Readonly<Record<string, string>> = {};

/** Production components outside `components/ui`: the files that compose, not the ones that define a control. */
function composingFiles(): string[] {
	return Array.from(new Bun.Glob("**/*.tsx").scanSync(SRC))
		.filter(
			(file) =>
				!file.startsWith("components/ui/") &&
				!file.startsWith("test/") &&
				!file.includes("/test-support/") &&
				!file.endsWith(".test.tsx"),
		)
		.sort();
}

/** The source with comments taken out, so a sentence that names an element is not a use of it. */
function code(file: string): string {
	return readFileSync(join(SRC, file), "utf8")
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/^\s*\/\/.*$/gm, "");
}

describe("the panel composes its screens from its own components", () => {
	it("no screen writes by hand a control the panel has a component for", () => {
		const found: string[] = [];
		for (const file of composingFiles()) {
			if (file in KNOWN) {
				continue;
			}
			const source = code(file);
			for (const [pattern, instead] of HAND_MADE) {
				if (pattern.test(source)) {
					found.push(`${file}: use ${instead}`);
				}
			}
		}

		expect(found).toEqual([]);
	});

	it("every file excused still needs its excuse", () => {
		for (const file of Object.keys(KNOWN)) {
			const source = code(file);
			expect([
				file,
				HAND_MADE.some(([pattern]) => pattern.test(source)),
			]).toEqual([file, true]);
		}
	});

	it("looks at the screens: it reads files, and finds a hand-made control when there is one", () => {
		expect(composingFiles().length).toBeGreaterThan(80);
		const sample = '<label>x<select name="a"></select></label>';
		expect(HAND_MADE.some(([pattern]) => pattern.test(sample))).toBe(true);
		expect(
			HAND_MADE.some(([pattern]) =>
				pattern.test('<input type="radio" name="q" />'),
			),
		).toBe(true);
	});
});
