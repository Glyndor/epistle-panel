import { readFileSync } from "node:fs";
import { join } from "node:path";

export const SRC = join(import.meta.dir, "..", "..", "..");

/** Keep line numbers and quoted text; comments cannot satisfy a guard. */
export function code(source: string): string {
	return source.replace(
		/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,
		(token) =>
			token.startsWith("/") ? token.replace(/[^\n]/g, " ") : token,
	);
}

export function read(file: string): string {
	return code(readFileSync(join(SRC, file), "utf8"));
}

/** The same production-source walk as the other source-reading guards. */
export function productionFiles(): string[] {
	return Array.from(new Bun.Glob("**/*.{ts,tsx}").scanSync(SRC))
		.filter(
			(file) =>
				!file.startsWith("test/") &&
				!file.includes("/test-support/") &&
				!/\.test\.tsx?$/.test(file),
		)
		.sort();
}

/** Find the end of an expression/tag without mistaking an arrow or quoted > for its end. */
export function endOf(source: string, start: number, closing: string): number {
	for (let i = start; i < source.length; i++) {
		const char = source[i];
		if (char === '"' || char === "'" || char === "`") {
			const quote = char;
			while (++i < source.length) {
				if (source[i] === "\\") i++;
				else if (source[i] === quote) break;
			}
		} else if (char === "{" || char === "(" || char === "[") {
			i = endOf(
				source,
				i + 1,
				char === "{" ? "}" : char === "(" ? ")" : "]",
			);
		} else if (char === closing) return i;
	}
	throw new Error(
		`Unclosed ${closing} in source guard near ${source.slice(start, start + 60)}`,
	);
}

export type Element = {
	tag: string;
	attrs: string;
	start: number;
	parents: Element[];
};

/** Source-level JSX walk: nesting is tracked per element, never per file. */
export function elements(source: string): Element[] {
	const result: Element[] = [];
	const stack: Element[] = [];
	const tokens =
		/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|<\/?([A-Za-z][\w.]*)\b/g;
	for (let match = tokens.exec(source); match; match = tokens.exec(source)) {
		const tag = match[1];
		if (!tag || /[\w.$]/.test(source[match.index - 1] ?? "")) continue;
		const end = endOf(source, tokens.lastIndex, ">");
		const attrs = source.slice(tokens.lastIndex, end);
		if (match[0].startsWith("</")) {
			const index = stack.findLastIndex((item) => item.tag === tag);
			if (index >= 0) stack.length = index;
		} else {
			const element = {
				tag,
				attrs,
				start: match.index,
				parents: [...stack],
			};
			result.push(element);
			// JSX in a prop is a separate tree, not a descendant in the DOM.
			for (const nested of elements(attrs))
				result.push({
					...nested,
					start: nested.start + tokens.lastIndex,
				});
			if (!attrs.trimEnd().endsWith("/")) stack.push(element);
		}
		tokens.lastIndex = end + 1;
	}
	return result;
}

/** Attribute values can be a literal or a balanced JSX expression. */
export function attribute(element: Element, name: string): string {
	const match = new RegExp(`(?:^|\\s)${name}\\s*=\\s*`).exec(element.attrs);
	if (!match) return "";
	const start = match.index + match[0].length;
	const first = element.attrs[start];
	if (first === "{")
		return element.attrs.slice(
			start + 1,
			endOf(element.attrs, start + 1, "}"),
		);
	if (first === '"' || first === "'")
		return element.attrs.slice(
			start,
			element.attrs.indexOf(first, start + 1) + 1,
		);
	return "";
}

export function location(
	file: string,
	source: string,
	element: Element,
): string {
	return `${file}:${source.slice(0, element.start).split("\n").length} <${element.tag}>`;
}
