import { attribute, type Element, elements, location } from "../source";
import { baseClasses, classText, hasSelectNone } from "../source/classes";

const ROLES = new Set([
	"button",
	"tab",
	"menuitem",
	"menuitemcheckbox",
	"menuitemradio",
]);

/** Identify HTML, router links, Radix parts and polymorphic button/link roots. */
export function interactive(element: Element, source: string): boolean {
	const role = attribute(element, "role").replace(/["'{}\s]/g, "");
	if (ROLES.has(role) || element.tag === "button") return true;
	if (
		(element.tag === "a" || element.tag === "Link") &&
		attribute(element, "href")
	)
		return true;
	if (
		/\.(Trigger|CollapsibleTrigger|Item|RadioItem|CheckboxItem|Close|Action|Cancel)$/.test(
			element.tag,
		)
	)
		return true;
	if (/^[A-Z]\w*$/.test(element.tag)) {
		const declarations = [
			...source
				.slice(0, element.start)
				.matchAll(
					new RegExp(`\\bconst\\s+${element.tag}\\s*=([^;]+);`, "g"),
				),
		];
		return /["'](?:button|a)["']/.test(declarations.at(-1)?.[1] ?? "");
	}
	return false;
}

/** Only the panel's imported, guarded parts confer selection through composition. */
export function shared(element: Element, source: string): boolean {
	const imports =
		/import\s*\{([^}]+)\}\s*from\s*["'](@\/components\/ui\/[^"']+)["']/g;
	const parts: Readonly<Record<string, string>> = {
		Button: "button",
		Badge: "badge",
		SidebarMenuButton: "sidebar/menu",
		CollapsibleTrigger: "collapsible",
		DropdownMenuItem: "dropdown-menu",
		DropdownMenuCheckboxItem: "dropdown-menu",
		DropdownMenuRadioItem: "dropdown-menu",
		PaginationLink: "pagination",
		PaginationNext: "pagination",
		PaginationPrevious: "pagination",
		AlertDialogAction: "alert-dialog",
		AlertDialogCancel: "alert-dialog",
	};
	for (const match of source.matchAll(imports)) {
		for (const specifier of (match[1] ?? "").split(",")) {
			const [name, alias] = specifier.trim().split(/\s+as\s+/);
			if (
				name &&
				match[2] === `@/components/ui/${parts[name]}` &&
				(alias ?? name) === element.tag
			)
				return true;
		}
	}
	return false;
}

export function selectionFailures(
	file: string,
	source: string,
	ui: boolean,
): string[] {
	const tree = elements(source);
	const failures = tree
		.filter((element) => {
			const mandatory =
				ui &&
				(element.tag === "a" ||
					attribute(element, "data-slot") === '"badge"');
			if (!mandatory && !interactive(element, source)) return false;
			if (shared(element, source)) return false;
			if (
				hasSelectNone(
					baseClasses(attribute(element, "className"), source),
				)
			)
				return false;
			return !element.parents.some((parent) => shared(parent, source));
		})
		.map(
			(element) =>
				`${location(file, source, element)}: missing select-none in base classes`,
		);
	if (file === "components/ui/tooltip/index.tsx") {
		// The visual label box, not the Slot which forwards props to the control.
		const boxes = tree.filter((element) => {
			const parent = element.parents.at(-1);
			return parent !== undefined && attribute(parent, "ref") === "tip";
		});
		if (boxes.length !== 1)
			failures.push(
				`${file}: expected one tooltip label box under ref={tip}`,
			);
		for (const box of boxes)
			if (
				!hasSelectNone(baseClasses(attribute(box, "className"), source))
			)
				failures.push(
					`${location(file, source, box)}: tooltip box missing select-none in base classes`,
				);
	}
	return failures;
}

/** Protect data and all local containers around it; shared buttons may still be chrome. */
export function contentFailures(file: string, source: string): string[] {
	return elements(source)
		.filter(
			(element) =>
				!shared(element, source) &&
				/\bselect-none\b/.test(
					classText(attribute(element, "className"), source),
				),
		)
		.map(
			(element) =>
				`${location(file, source, element)}: content must stay selectable; remove select-none`,
		);
}
