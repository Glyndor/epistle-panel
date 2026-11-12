import { describe, expect, it, mock } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
	clientStandIn,
	intl,
	resetIntl,
	serverStandIn,
	withStandInExports,
} from ".";

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

	it("keep an export a file's own mock leaves out", () => {
		const own = () => "mine";
		const merged = withStandInExports("next-intl", () => ({
			useTranslations: own,
		}))() as Record<string, unknown>;

		expect(merged.NextIntlClientProvider).toBe(
			clientStandIn().NextIntlClientProvider,
		);
		expect(merged.useTranslations).toBe(own);
	});

	it("leave the mock of any other module alone", () => {
		const own = { revalidatePath: () => {} };

		expect(withStandInExports("next/cache", () => own)()).toBe(own);
	});

	it("wrap mock.module for the whole run once installed", () => {
		const registry = mock as unknown as Record<symbol, boolean>;

		expect(registry[Symbol.for("epistle-panel.next-intl-mock-merge")]).toBe(
			true,
		);
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
