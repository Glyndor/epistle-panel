import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";

const SRC = join(import.meta.dir, "..", "..");

/**
 * The overview of an account brings no form stack.
 *
 * The overview is the one section a person may read on a machine that never
 * types in it, and it is the section the address names by default, so it is
 * the one every visit to an account pays for. Its code is its own chunk: the
 * form library and the schemas that go with it are the weight of the profile
 * and the security sections, and nothing of that may reach the overview.
 *
 * The walk is the one of `src/test/client-without-zod`: the imports of a
 * module, resolved file by file, stopping at a module that starts with
 * `"use server"` (the browser gets a reference to its actions, not its code).
 * A form stack is `react-hook-form`, the resolver that binds it to a schema,
 * or the full `zod`: `zod/mini` is what a schema the browser runs is written
 * in, and it is not the stack this guard is about.
 */
const IMPORT =
	/(?:^|\n)\s*(?:import|export)\s+(type\s+)?[^;"]*?from\s+"([^"]+)"|\bimport\("([^"]+)"\)/g;

const FORM_STACK = [
	"react-hook-form",
	"@hookform/resolvers",
	"@hookform/resolvers/zod",
	"zod",
];

const resolve = (specifier: string, from: string): string | null => {
	const base = specifier.startsWith("@/")
		? join(SRC, specifier.slice(2))
		: specifier.startsWith(".")
			? normalize(join(dirname(from), specifier))
			: null;
	if (base === null) {
		return null;
	}
	return (
		[
			`${base}.ts`,
			`${base}.tsx`,
			join(base, "index.ts"),
			join(base, "index.tsx"),
		].find((candidate) => existsSync(candidate)) ?? null
	);
};

/** The modules a source brings in at run time: `import type` lines bring nothing. */
function runtimeImports(source: string): string[] {
	const found: string[] = [];
	for (const match of source.matchAll(IMPORT)) {
		if (match[1] === undefined) {
			found.push(match[2] ?? match[3] ?? "");
		}
	}
	return found;
}

const starts = (source: string, directive: string) =>
	source.trimStart().startsWith(`"${directive}"`);

/**
 * The chain of files from a module to the form stack, or `null`. Every file
 * of the chain is named, so the failure says what brought it in.
 */
function chainToFormStack(entry: string): string[] | null {
	const cameFrom = new Map<string, string | null>([[entry, null]]);
	const pending = [entry];
	while (pending.length > 0) {
		const file = pending.pop() as string;
		const source = readFileSync(file, "utf8");
		if (file !== entry && starts(source, "use server")) {
			continue;
		}
		for (const specifier of runtimeImports(source)) {
			if (FORM_STACK.includes(specifier)) {
				const chain = [file];
				for (
					let at = cameFrom.get(file);
					at !== null && at !== undefined;
					at = cameFrom.get(at)
				) {
					chain.unshift(at);
				}
				return chain;
			}
			const next = resolve(specifier, file);
			if (next !== null && !cameFrom.has(next)) {
				cameFrom.set(next, file);
				pending.push(next);
			}
		}
	}
	return null;
}

const OVERVIEW = join(
	SRC,
	"features/account-detail/components/overview-section/index.tsx",
);
const PROFILE = join(
	SRC,
	"features/account-detail/components/profile-section/index.tsx",
);

describe("the overview of an account", () => {
	it("brings no form stack, through any chain of imports", () => {
		const chain = chainToFormStack(OVERVIEW);

		expect(chain).toBeNull();
	});

	it("reads a form stack when there is one, so the walk above is not empty", () => {
		const chain = chainToFormStack(PROFILE);

		expect(chain).not.toBeNull();
		expect(readFileSync(PROFILE, "utf8")).toContain(
			'from "react-hook-form"',
		);
	});
});
