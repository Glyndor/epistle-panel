import { interactive, shared } from "../selection";
import { attribute, elements, location } from "../source";
import { classText } from "../source/classes";

/** Literal tokens include conditional classes too: a variant cannot override the base map. */
export function utilityFailures(file: string, source: string): string[] {
	return elements(source)
		.filter(
			(element) =>
				interactive(element, source) ||
				shared(element, source) ||
				(file.startsWith("components/ui/") && element.tag === "a"),
		)
		.flatMap((element) => {
			const expression = attribute(element, "className");
			const classes = classText(expression, source);
			const forbidden = [
				...new Set(
					classes.match(
						/(?:[\w:[\]=.-]+:)?(?:hover:cursor-pointer|cursor-default)\b/g,
					) ?? [],
				),
			];
			return forbidden.map(
				(token) =>
					`${location(file, source, element)}: ${token} overrides the base cursor rule`,
			);
		});
}
