import { endOf } from ".";

/** Resolve only base classes: conditional branches/variant objects cannot supply select-none. */
export function baseClasses(
	expression: string,
	source: string,
	seen = new Set<string>(),
): string {
	const value = expression.trim();
	if (/^(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`[^`$]*`)$/.test(value))
		return value.slice(1, -1);
	const call = /^(\w+)\s*\(/.exec(value);
	if (call) {
		if (!["cn", "cva", "clsx"].includes(call[1] ?? "")) {
			return baseClasses(call[1] ?? "", source, seen);
		}
		const args: string[] = [];
		const start = call[0].length;
		let previous = start;
		for (let i = start; i < value.length; i++) {
			const char = value[i];
			if (char === '"' || char === "'" || char === "`") {
				const quote = char;
				while (++i < value.length) {
					if (value[i] === "\\") i++;
					else if (value[i] === quote) break;
				}
			} else if (char === "(" || char === "{" || char === "[") {
				i = endOf(
					value,
					i + 1,
					char === "(" ? ")" : char === "{" ? "}" : "]",
				);
			} else if (char === "," || char === ")") {
				args.push(value.slice(previous, i));
				previous = i + 1;
				if (call[1] === "cva" || char === ")") break;
			}
		}
		return args
			.map((arg) => baseClasses(arg, source, new Set(seen)))
			.join(" ");
	}
	if (/^\w+$/.test(value) && !seen.has(value)) {
		seen.add(value);
		const declaration = new RegExp(`\\bconst\\s+${value}\\s*=\\s*`).exec(
			source,
		);
		if (declaration) {
			const start = declaration.index + declaration[0].length;
			return baseClasses(
				source.slice(start, endOf(source, start, ";")),
				source,
				seen,
			);
		}
		// These imported bases are guarded at their definitions as well.
		if (
			/\bimport\s*\{[^}]*\bbuttonVariants\b[^}]*\}\s*from\s*["']@\/components\/ui\/button["']/.test(
				source,
			) &&
			value === "buttonVariants"
		)
			return "select-none";
	}
	return "";
}

export function hasSelectNone(classes: string): boolean {
	return classes.split(/\s+/).includes("select-none");
}

/** All possible class tokens, including variants and referenced local constants. */
export function classText(
	expression: string,
	source: string,
	seen = new Set<string>(),
): string {
	let result = expression;
	for (const match of expression.matchAll(/\b[A-Za-z_]\w*\b/g)) {
		const name = match[0];
		if (seen.has(name)) continue;
		seen.add(name);
		const declaration = new RegExp(`\\bconst\\s+${name}\\s*=\\s*`).exec(
			source,
		);
		if (!declaration) continue;
		const start = declaration.index + declaration[0].length;
		result += ` ${classText(source.slice(start, endOf(source, start, ";")), source, seen)}`;
	}
	return result;
}
