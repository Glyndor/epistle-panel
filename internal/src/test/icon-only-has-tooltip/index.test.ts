import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = join(import.meta.dir, "..", "..");

/**
 * A control that is an icon alone says nothing to someone who sees it and does
 * not know the icon. Its accessible name is for a screen reader; for the eye
 * there is the panel's tooltip (`components/ui/tooltip`), which shows that
 * name, and the control's key when it has one, on hover and on keyboard focus.
 * So every button of the icon size is the child of a `Tooltip`.
 */

/** A button of the icon size: one whose only content is an icon. */
const ICON_BUTTON = /<Button\b[^>]*?\bsize="icon"/s;

/**
 * Icon buttons that have no tooltip, each with the reason. An entry leaves
 * this list when the file is changed; nothing is added to it.
 */
const KNOWN: Readonly<Record<string, string>> = {};

/** The source with comments taken out, so a sentence that names a button is not one. */
function code(source: string): string {
	return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/**
 * How many icon buttons of `source` are not the child of a `Tooltip`: the
 * element that opens last before the button, and is still open, must be one.
 */
function bareIconButtons(source: string): number {
	const text = code(source);
	let bare = 0;
	for (const match of text.matchAll(new RegExp(ICON_BUTTON, "gs"))) {
		const before = text.slice(0, match.index);
		const opened = before.lastIndexOf("<Tooltip");
		const closed = before.lastIndexOf("</Tooltip>");
		// The tooltip takes one child: nothing but its own opening tag may
		// stand between it and the button.
		const between = opened === -1 ? "" : before.slice(opened);
		const direct = /^<Tooltip\b[^<]*>\s*$/s.test(
			between.replace(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/gs, "{}"),
		);
		if (opened === -1 || closed > opened || !direct) {
			bare += 1;
		}
	}
	return bare;
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

describe("a control that is an icon alone is named in a tooltip", () => {
	it("finds the icon buttons of the panel", () => {
		const withOne = productionFiles().filter((file) =>
			ICON_BUTTON.test(code(readFileSync(join(SRC, file), "utf8"))),
		);

		expect(withOne).toContain("components/ui/sidebar/trigger/index.tsx");
		expect(withOne).toContain(
			"features/theme/components/theme-trigger/index.tsx",
		);
		expect(withOne.length).toBeGreaterThanOrEqual(5);
	});

	it("every button of the icon size is the child of a Tooltip", () => {
		const found: string[] = [];
		for (const file of productionFiles()) {
			if (file in KNOWN) {
				continue;
			}
			const bare = bareIconButtons(readFileSync(join(SRC, file), "utf8"));
			if (bare > 0) {
				found.push(`${file}: ${bare} icon button without a Tooltip`);
			}
		}

		expect(found).toEqual([]);
	});

	it("every file excused still needs its excuse", () => {
		for (const file of Object.keys(KNOWN)) {
			expect([
				file,
				bareIconButtons(readFileSync(join(SRC, file), "utf8")) > 0,
			]).toEqual([file, true]);
		}
	});

	it("the check itself sees a bare icon button, and lets a wrapped one through", () => {
		expect(
			bareIconButtons(
				'<Button variant="ghost" size="icon"><X /></Button>',
			),
		).toBe(1);
		expect(
			bareIconButtons(
				'<Tooltip label={t("close")} align="end">\n<Button size="icon"><X /></Button>\n</Tooltip>',
			),
		).toBe(0);
		// A tooltip that closed before the button does not name it.
		expect(
			bareIconButtons(
				'<Tooltip label="a"><Button size="icon" /></Tooltip>\n<Button size="icon" />',
			),
		).toBe(1);
		// Nor one that holds the button somewhere deeper than its one child.
		expect(
			bareIconButtons(
				'<Tooltip label="a"><div><Button size="icon" /></div></Tooltip>',
			),
		).toBe(1);
		// A label written with a call and an object is still one opening tag.
		expect(
			bareIconButtons(
				'<Tooltip\n\tlabel={t("remove", { name: file.name })}\n>\n\t<Button\n\t\ttype="button"\n\t\tsize="icon"\n\t/>\n</Tooltip>',
			),
		).toBe(0);
		// A button of another size, and a sentence about one, are not counted.
		expect(bareIconButtons('<Button size="sm">Save</Button>')).toBe(0);
		expect(
			bareIconButtons('/** Not <Button size="icon" />. */\nexport {};'),
		).toBe(0);
	});
});
