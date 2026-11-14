import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

const SRC = join(import.meta.dir, "..", "..");

/**
 * A module that starts with `"use client"` gives the server a reference to
 * each of its exports, not the export. A component passes through as one and
 * is rendered in the browser. A constant or a function does not: the server
 * holds a reference where it expects a value. Both layouts read the sidebar's
 * cookie under a name imported that way, so the request was asked for a cookie
 * named by a reference, never found it, and the sidebar was served expanded
 * whatever the person had chosen. No unit test saw it: without a bundler the
 * import is the plain value.
 *
 * So a file that only ever runs on the server (a page, a layout, a loading
 * state, a default of a slot, a route handler, a module marked `server-only`)
 * imports nothing from a client module but components and types.
 */

const read = (file: string) => readFileSync(join(SRC, file), "utf8");

/** The source with comments taken out. */
function code(source: string): string {
	return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const isClientModule = (source: string) =>
	/^\s*["']use client["'];?/.test(code(source));

/** The file an import names, among the shapes the panel uses. */
function resolve(specifier: string, from: string): string | null {
	const base = specifier.startsWith("@/")
		? specifier.slice(2)
		: specifier.startsWith(".")
			? join(dirname(from), specifier)
			: null;
	if (base === null) {
		return null;
	}
	for (const candidate of [
		`${base}.ts`,
		`${base}.tsx`,
		join(base, "index.ts"),
		join(base, "index.tsx"),
	]) {
		if (existsSync(join(SRC, candidate))) {
			return candidate;
		}
	}
	return null;
}

/** The value names a source imports from each module: types are left out. */
function valueImports(source: string): Array<[string, string[]]> {
	const found: Array<[string, string[]]> = [];
	const pattern =
		/import\s+(type\s+)?(?:([A-Za-z_$][\w$]*)\s*,?\s*)?(?:\{([^}]*)\})?\s*from\s*["']([^"']+)["']/g;
	for (const match of code(source).matchAll(pattern)) {
		if (match[1] !== undefined) {
			continue;
		}
		const names = (match[3] ?? "")
			.split(",")
			.map((name) => name.trim())
			.filter((name) => name !== "" && !name.startsWith("type "))
			.map((name) => name.split(/\s+as\s+/)[0] ?? "");
		if (match[2] !== undefined) {
			names.push(match[2]);
		}
		found.push([match[4] ?? "", names]);
	}
	return found;
}

/** A name a component has: the one thing a client module may hand the server. */
const isComponentName = (name: string) => /^[A-Z][a-z0-9]/.test(name);

/** What `file` imports from a client module that is not a component. */
function clientValuesIn(file: string, source: string): string[] {
	const found: string[] = [];
	for (const [specifier, names] of valueImports(source)) {
		const target = resolve(specifier, file);
		if (target === null || !isClientModule(read(target))) {
			continue;
		}
		for (const name of names) {
			if (!isComponentName(name)) {
				found.push(`${file}: ${name} from ${specifier}`);
			}
		}
	}
	return found;
}

/** The files that only ever run on the server. */
function serverFiles(): string[] {
	return Array.from(new Bun.Glob("**/*.{ts,tsx}").scanSync(SRC))
		.filter(
			(file) =>
				!file.startsWith("test/") &&
				!file.includes("/test-support/") &&
				!/\.test\.tsx?$/.test(file),
		)
		.filter((file) => {
			const source = read(file);
			if (isClientModule(source)) {
				return false;
			}
			return (
				/(^|\/)(page|layout|loading|default|not-found|route)\.tsx?$/.test(
					file,
				) || /import\s+["']server-only["']/.test(code(source))
			);
		})
		.sort();
}

describe("the server takes only components from a client module", () => {
	it("finds the files that only run on the server", () => {
		const files = serverFiles();

		expect(files).toContain("app/app/mail/layout.tsx");
		expect(files).toContain("app/app/[adminId]/layout.tsx");
		expect(files).toContain("features/mail/queries/request-mail/index.ts");
		expect(files.length).toBeGreaterThan(60);
	});

	it("no such file imports a constant or a function from a client module", () => {
		const found = serverFiles().flatMap((file) =>
			clientValuesIn(file, read(file)),
		);

		expect(found).toEqual([]);
	});

	it("both layouts read the sidebar's cookie under a name that is a value on the server", () => {
		for (const file of [
			"app/app/mail/layout.tsx",
			"app/app/[adminId]/layout.tsx",
		]) {
			const from = valueImports(read(file)).find(([, names]) =>
				names.includes("SIDEBAR_COOKIE"),
			)?.[0];
			expect([file, from]).toEqual([
				file,
				"@/components/ui/sidebar/cookie",
			]);
			const target = resolve(from ?? "", file);
			expect(target).not.toBeNull();
			expect(isClientModule(read(target ?? ""))).toBe(false);
		}
	});

	it("the check itself sees a value taken from a client module, and lets a component and a type through", () => {
		const layout = "app/app/mail/layout.tsx";
		const provider = "@/components/ui/sidebar/provider";
		expect(
			isClientModule(read("components/ui/sidebar/provider/index.tsx")),
		).toBe(true);

		expect(
			clientValuesIn(
				layout,
				`import { SIDEBAR_COOKIE } from "${provider}";`,
			),
		).toEqual([`${layout}: SIDEBAR_COOKIE from ${provider}`]);
		expect(
			clientValuesIn(
				layout,
				`import { SidebarProvider, useThing as use } from "${provider}";`,
			),
		).toEqual([`${layout}: useThing from ${provider}`]);
		expect(
			clientValuesIn(
				layout,
				`import { SidebarProvider } from "${provider}";`,
			),
		).toEqual([]);
		expect(
			clientValuesIn(
				layout,
				`import type { Thing } from "${provider}";\nimport { type Other, SidebarProvider } from "${provider}";`,
			),
		).toEqual([]);
		// A module with no directive hands over whatever it exports.
		expect(
			clientValuesIn(
				layout,
				'import { SIDEBAR_COOKIE } from "@/components/ui/sidebar/cookie";',
			),
		).toEqual([]);
	});
});
