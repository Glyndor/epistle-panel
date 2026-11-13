/**
 * A just-enough reader of ICU message syntax for the parity test: it lists the
 * arguments a message uses, with their type and, for a plural or select, the
 * selectors of its arms, and it throws when the braces do not balance. It is
 * not a formatter; `next-intl` does the real parsing at runtime. What it must
 * get right is telling `{name}` (an argument) from `{No rows}` (the text of an
 * arm), which a regular expression over the whole string cannot.
 */

/** One argument of a message: `name`, `name:number`, `total:plural[=0|one|other]`. */
export type IcuArgument = string;

const BRANCHING = new Set(["plural", "select", "selectordinal"]);

/** The arguments of `message` in source order, nested arms included. */
export function icuArguments(message: string): IcuArgument[] {
	const out: IcuArgument[] = [];
	const end = readText(message, 0, out, false);
	if (end !== message.length) {
		throw new Error(`Unbalanced "}" in: ${message}`);
	}
	return out;
}

/** Read text up to the closing `}` of the enclosing arm, or the end of input. */
function readText(
	message: string,
	start: number,
	out: IcuArgument[],
	nested: boolean,
): number {
	let i = start;
	while (i < message.length) {
		const char = message[i];
		if (char === "}") {
			return i;
		}
		i = char === "{" ? readArgument(message, i + 1, out) : i + 1;
	}
	if (nested) {
		throw new Error(`Unclosed "{" in: ${message}`);
	}
	return i;
}

/** Read one `{...}` argument, starting after its `{`; return the index after its `}`. */
function readArgument(
	message: string,
	start: number,
	out: IcuArgument[],
): number {
	const close = message.indexOf("}", start);
	const comma = message.indexOf(",", start);
	if (close === -1) {
		throw new Error(`Unclosed "{" in: ${message}`);
	}
	if (comma === -1 || comma > close) {
		out.push(message.slice(start, close).trim());
		return close + 1;
	}
	const name = message.slice(start, comma).trim();
	const rest = message.slice(comma + 1);
	const type = /^\s*(\w+)\s*/.exec(rest)?.[1] ?? "";
	let i = comma + 1 + (/^\s*\w+\s*/.exec(rest)?.[0].length ?? 0);
	if (!BRANCHING.has(type)) {
		const end = message.indexOf("}", i);
		if (end === -1) {
			throw new Error(`Unclosed "{" in: ${message}`);
		}
		out.push(`${name}:${type}`);
		return end + 1;
	}
	if (message[i] !== ",") {
		throw new Error(`Missing "," after ${name}, ${type} in: ${message}`);
	}
	i += 1;
	const selectors: string[] = [];
	const inner: IcuArgument[] = [];
	for (;;) {
		while (/\s/.test(message[i] ?? "")) {
			i += 1;
		}
		if (message[i] === "}") {
			break;
		}
		const selector = /^[^\s{}]+/.exec(message.slice(i))?.[0];
		if (!selector) {
			throw new Error(`Bad arm of ${name} in: ${message}`);
		}
		i += selector.length;
		while (/\s/.test(message[i] ?? "")) {
			i += 1;
		}
		if (message[i] !== "{") {
			throw new Error(`Arm ${selector} has no body in: ${message}`);
		}
		selectors.push(selector);
		i = readText(message, i + 1, inner, true);
		i += 1;
	}
	out.push(`${name}:${type}[${[...selectors].sort().join("|")}]`, ...inner);
	return i + 1;
}
