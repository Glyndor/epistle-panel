import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { clientStandIn, intl, resetIntl, serverStandIn } from ".";

const SRC = join(import.meta.dir, "..", "..");

/** Every file under `src` whose name matches `pattern`. */
function sourceFiles(pattern: RegExp): string[] {
	return Array.from(new Bun.Glob("**/*.{ts,tsx}").scanSync(SRC)).filter(
		(file) => pattern.test(file),
	);
}

/** Names imported from `specifier` by the production files under `src`. */
function importedNames(specifier: string): string[] {
	const names = new Set<string>();
	const statement = new RegExp(
		`import\\s*\\{([^}]*)\\}\\s*from\\s*"${specifier}"`,
		"g",
	);
	for (const file of sourceFiles(/^(?!.*\.test\.)(?!test\/).*\.tsx?$/)) {
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

describe("next-intl stand-ins", () => {
	it("export every name the panel imports from next-intl/server", async () => {
		const standIn = serverStandIn();
		const wanted = importedNames("next-intl/server");

		expect(wanted).toContain("getTranslations");
		for (const name of wanted) {
			expect(standIn).toHaveProperty(name);
		}
	});

	it("export every name the panel imports from next-intl", async () => {
		const standIn = clientStandIn();
		const wanted = importedNames("next-intl");

		expect(wanted).toContain("useTranslations");
		for (const name of wanted) {
			expect(standIn).toHaveProperty(name);
		}
	});

	it("are the only mock of next-intl/server in the suite", () => {
		// A second mock with another export set makes the suite pass or fail
		// with the file order (`bun test --randomize`).
		const offenders = sourceFiles(/\.test\.tsx?$/).filter(
			(file) =>
				file !== "test/next-intl/index.test.ts" &&
				/mock\.module\(\s*"next-intl\/server"/.test(
					readFileSync(join(SRC, file), "utf8"),
				),
		);

		expect(offenders).toEqual([]);
	});

	it("serve the locale and catalog a test sets and reset them", async () => {
		const { getLocale, getMessages } = serverStandIn();
		intl.locale = "es";
		intl.messages = { nav: {} };

		expect(await getLocale()).toBe("es");
		expect(await getMessages()).toEqual({ nav: {} });

		resetIntl();
		expect(await getLocale()).toBe("en");
		expect(await getMessages()).toEqual({});
	});
});
