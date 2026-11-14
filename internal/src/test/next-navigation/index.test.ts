import { describe, expect, it, mock } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { withStandInExports } from "../next-intl";
import { headersStandIn, navigationStandIn } from ".";

const SRC = join(import.meta.dir, "..", "..");

/** Names imported from `specifier` by the production files under `src`. */
function importedNames(specifier: string): string[] {
	const names = new Set<string>();
	const statement = new RegExp(
		`import\\s*\\{([^}]*)\\}\\s*from\\s*"${specifier}"`,
		"g",
	);
	const production = Array.from(
		new Bun.Glob("**/*.{ts,tsx}").scanSync(SRC),
	).filter((file) => /^(?!.*\.test\.)(?!test\/).*\.tsx?$/.test(file));
	for (const file of production) {
		for (const match of readFileSync(join(SRC, file), "utf8").matchAll(
			statement,
		)) {
			for (const name of (match[1] ?? "").split(",")) {
				const bare = name.trim().split(/\s+as\s+/)[0];
				if (bare) {
					names.add(bare);
				}
			}
		}
	}
	return [...names].sort();
}

describe("the stand-ins for next/navigation and next/headers", () => {
	it("export every name the panel imports from next/navigation", () => {
		const wanted = importedNames("next/navigation");

		expect(wanted).toContain("notFound");
		for (const name of wanted) {
			expect(navigationStandIn()).toHaveProperty(name);
		}
	});

	it("export every name the panel imports from next/headers", () => {
		const wanted = importedNames("next/headers");

		expect(wanted).toContain("cookies");
		for (const name of wanted) {
			expect(headersStandIn()).toHaveProperty(name);
		}
	});

	it("keep what a file's own mock leaves out, and let its own exports win", () => {
		const own = () => "/somewhere";
		const merged = withStandInExports("next/navigation", () => ({
			usePathname: own,
		}))() as Record<string, unknown>;

		expect(merged["usePathname"]).toBe(own);
		expect(typeof merged["notFound"]).toBe("function");
		expect(typeof merged["redirect"]).toBe("function");
	});

	it("a file that mocks next/navigation with two exports does not take notFound from the files after it", async () => {
		// What a test file does: a mock of its own, with only what it uses.
		mock.module("next/navigation", () => ({
			usePathname: () => "/x",
			redirect: () => {
				throw new Error("NEXT_REDIRECT");
			},
		}));

		const navigation = await import("next/navigation");

		expect(navigation.usePathname()).toBe("/x");
		expect(() => navigation.notFound()).toThrow("NEXT_NOT_FOUND");
		mock.module("next/navigation", navigationStandIn);
	});
});
