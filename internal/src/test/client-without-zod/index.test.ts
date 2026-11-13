import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";

const SRC = join(import.meta.dir, "..", "..");

/**
 * No module that runs in the browser reaches the full `zod`.
 *
 * The full build compiles its object schemas with `new Function`, and tries it
 * once to see whether it may. Under the panel's policy that try is refused and
 * reported as a `script-src` violation (measured on `/accounts`: the delete
 * dialog imported one constant from `lib/api/schemas`, and the whole library
 * and every API schema came with it, about 60 KB of the route). A schema the
 * page needs is written in `zod/mini`, and a constant it needs lives in a file
 * without the library.
 *
 * A file that starts with `"use server"` is where the walk stops: the browser
 * gets a reference to its actions, not its code.
 */
const IMPORT =
	/(?:^|\n)\s*(?:import|export)\s+(type\s+)?[^;"]*?from\s+"([^"]+)"|\bimport\("([^"]+)"\)/g;

function resolve(specifier: string, from: string): string | null {
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
}

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

/** The chain of files from a client module to the full `zod`, or `null`. */
function chainToZod(
	entry: string,
	read: (file: string) => string = (file) => readFileSync(file, "utf8"),
	find: (specifier: string, from: string) => string | null = resolve,
): string[] | null {
	const cameFrom = new Map<string, string | null>([[entry, null]]);
	const pending = [entry];
	while (pending.length > 0) {
		const file = pending.pop() as string;
		const source = read(file);
		if (file !== entry && starts(source, "use server")) {
			continue;
		}
		for (const specifier of runtimeImports(source)) {
			if (specifier === "zod") {
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
			const next = find(specifier, file);
			if (next !== null && !cameFrom.has(next)) {
				cameFrom.set(next, file);
				pending.push(next);
			}
		}
	}
	return null;
}

function clientModules(): string[] {
	return Array.from(new Bun.Glob("**/*.{ts,tsx}").scanSync(SRC))
		.filter(
			(file) =>
				!file.startsWith("test/") &&
				!file.includes("/test-support/") &&
				!/\.test\.tsx?$/.test(file),
		)
		.map((file) => join(SRC, file))
		.filter((file) => starts(readFileSync(file, "utf8"), "use client"))
		.sort();
}

describe("what runs in the browser does not bring the full zod", () => {
	it("no client module reaches it, through any chain of imports", () => {
		const modules = clientModules();
		const reaching = modules
			.map((file) => chainToZod(file))
			.filter((chain): chain is string[] => chain !== null)
			.map((chain) =>
				chain.map((file) => file.slice(SRC.length + 1)).join(" -> "),
			);

		expect(reaching).toEqual([]);
		// It reads the panel: there are more client modules than this.
		expect(modules.length).toBeGreaterThan(30);
	});

	it("follows a chain to the library, skips a type import, and stops at a server action", () => {
		const files: Record<string, string> = {
			"/a.tsx": '"use client";\nimport { B } from "./b";\n',
			"/b.ts": 'import { c } from "./c";\nexport const B = c;\n',
			"/c.ts": 'import { z } from "zod";\nexport const c = z.string();\n',
			"/typed.tsx": '"use client";\nimport type { C } from "./c";\n',
			"/mini.tsx": '"use client";\nimport * as z from "zod/mini";\n',
			"/acts.tsx": '"use client";\nimport { act } from "./action";\n',
			"/action.ts": '"use server";\nimport { c } from "./c";\n',
			"/lazy.tsx": '"use client";\nconst later = () => import("./b");\n',
		};
		const read = (file: string) => files[file] ?? "";
		const find = (specifier: string) => {
			const file = `/${specifier.replace("./", "")}`;
			return (
				[`${file}.ts`, `${file}.tsx`].find((f) => f in files) ?? null
			);
		};
		const chain = (entry: string) => chainToZod(entry, read, find);

		expect(chain("/a.tsx")).toEqual(["/a.tsx", "/b.ts", "/c.ts"]);
		expect(chain("/lazy.tsx")).toEqual(["/lazy.tsx", "/b.ts", "/c.ts"]);
		expect(chain("/typed.tsx")).toBeNull();
		expect(chain("/mini.tsx")).toBeNull();
		expect(chain("/acts.tsx")).toBeNull();
	});
});
