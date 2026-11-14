import { endOf } from "../source";

const roles = [
	"button",
	"tab",
	"menuitem",
	"menuitemcheckbox",
	"menuitemradio",
	"option",
	"switch",
	"checkbox",
	"radio",
	"treeitem",
];
const pressTypes = [
	"button",
	"submit",
	"reset",
	"checkbox",
	"radio",
	"file",
	"color",
];
const press = [
	"a[href]",
	"button",
	"select",
	"summary",
	"label[for]",
	...roles.map((role) => `[role="${role}"]`),
	...pressTypes.map((type) => `input[type="${type}"]`),
];
const text = `input:not(${[...pressTypes.slice(0, 6), "range", "color"].map((type) => `[type="${type}"]`).join(",")})`;
const busyPress = [
	"a[href]",
	"button",
	"input",
	"select",
	"textarea",
	"summary",
	...[
		"button",
		"tab",
		"menuitem",
		"option",
		"switch",
		"checkbox",
		"radio",
	].map((role) => `[role="${role}"]`),
];

/** Independent selector contract: removing one selector must fail even if the cursor remains. */
export const RULES = [
	[press.join(","), "pointer"],
	[["textarea", text, '[contenteditable="true"]'].join(","), "text"],
	['[draggable="true"],input[type="range"]', "grab"],
	['[draggable="true"]:active,input[type="range"]:active', "grabbing"],
	['[role="separator"][aria-orientation="vertical"]', "col-resize"],
	[':disabled,[aria-disabled="true"]', "not-allowed"],
	['[aria-busy="true"]', "wait"],
	[`[aria-busy="true"]:is(${busyPress.join(",")})`, "progress"],
	['[aria-busy="true"]:is(:disabled,[aria-disabled="true"])', "wait"],
] as const;

export function cursorFailures(css: string): string[] {
	const source = css.replace(/\/\*[\s\S]*?\*\//g, "");
	const bases = [...source.matchAll(/@layer\s+base\s*\{/g)].map((match) => {
		const start = match.index + match[0].length;
		return source.slice(start, endOf(source, start, "}"));
	});
	const rules = bases.flatMap((base) =>
		[...base.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((match) =>
			/\bcursor\s*:/.test(match[2] ?? ""),
		),
	);
	const failures: string[] = [];
	let previous = -1;
	for (const [selectors, cursor] of RULES) {
		const expected = `:where(${selectors})`;
		const index = rules.findIndex(
			(rule) =>
				rule[1]?.replace(/\s/g, "") === expected &&
				new RegExp(`^\\s*cursor\\s*:\\s*${cursor}\\s*;\\s*$`).test(
					rule[2] ?? "",
				),
		);
		if (index < 0)
			failures.push(
				`app/globals.css @layer base: missing cursor: ${cursor} for ${expected}`,
			);
		else if (index <= previous)
			failures.push(
				`app/globals.css @layer base: cursor: ${cursor} has wrong precedence for ${expected}`,
			);
		previous = index;
	}
	return failures;
}
