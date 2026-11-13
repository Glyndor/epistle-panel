import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { SUPPORTED_LOCALES } from "@/i18n/locales";
import {
	CLIENT_NAMESPACES,
	loadMessages,
	NAMESPACES,
	pickClientMessages,
} from ".";
import { icuArguments } from "./test-support/icu";

/** Every dot-namespaced leaf key in a message catalog, with its string value. */
function leaves(catalog: unknown, prefix = ""): Map<string, string> {
	const out = new Map<string, string>();
	if (typeof catalog !== "object" || catalog === null) {
		return out;
	}
	for (const [key, value] of Object.entries(catalog)) {
		const path = prefix ? `${prefix}.${key}` : key;
		if (typeof value === "object" && value !== null) {
			for (const [k, v] of leaves(value, path)) {
				out.set(k, v);
			}
		} else {
			out.set(path, String(value));
		}
	}
	return out;
}

function filesOf(locale: string): string[] {
	return readdirSync(join(import.meta.dir, locale)).sort();
}

/** Every locale except English, which is the source the others are held to. */
const TRANSLATIONS = SUPPORTED_LOCALES.filter((locale) => locale !== "en");

describe("message catalogs", () => {
	it("has one folder per shipped locale and no other", () => {
		const folders = readdirSync(join(import.meta.dir), {
			withFileTypes: true,
		})
			.filter((entry) => entry.isDirectory())
			.map((entry) => entry.name)
			.filter((name) => name !== "test-support")
			.sort();
		expect(folders).toEqual([...SUPPORTED_LOCALES].sort());
	});

	it("declares exactly the namespace files present in each locale", () => {
		// A namespace file nobody lists is never loaded, and a listed one that is
		// missing breaks the merge, so the list and every tree must agree.
		const expected = NAMESPACES.map((name) => `${name}.json`).sort();
		for (const locale of SUPPORTED_LOCALES) {
			expect(filesOf(locale)).toEqual(expected);
		}
	});

	for (const locale of TRANSLATIONS) {
		describe(locale, () => {
			it("carries exactly the same keys as the English source", async () => {
				// A missing or orphaned translation key fails here, so the locales
				// can never silently drift apart.
				const en = await loadMessages("en");
				const translated = await loadMessages(locale);
				for (const namespace of NAMESPACES) {
					expect(
						[...leaves(translated[namespace]).keys()].sort(),
					).toEqual([...leaves(en[namespace]).keys()].sort());
				}
			});

			it("uses the same placeholders and plurals as the English source", async () => {
				const en = await loadMessages("en");
				const translated = await loadMessages(locale);
				for (const namespace of NAMESPACES) {
					const own = leaves(translated[namespace]);
					for (const [key, message] of leaves(en[namespace])) {
						const text = own.get(key) ?? "";
						const where = `${locale} ${namespace}.${key}`;
						expect({
							where,
							args: icuArguments(text).sort(),
						}).toEqual({
							where,
							args: icuArguments(message).sort(),
						});
					}
				}
			});

			it("has no empty message and no apostrophe that ICU would read as a quote", async () => {
				// `l'{name}` opens a quoted span in ICU and swallows the argument,
				// so the catalogs write a typographic apostrophe instead.
				const translated = await loadMessages(locale);
				for (const namespace of NAMESPACES) {
					for (const [key, text] of leaves(translated[namespace])) {
						expect({ key, empty: text.trim() === "" }).toEqual({
							key,
							empty: false,
						});
						expect({ key, quote: /'[{}]/.test(text) }).toEqual({
							key,
							quote: false,
						});
					}
				}
			});
		});
	}

	it("keeps the English source itself well formed", async () => {
		const en = await loadMessages("en");
		for (const namespace of NAMESPACES) {
			for (const message of leaves(en[namespace]).values()) {
				expect(() => icuArguments(message)).not.toThrow();
			}
		}
	});
});

/** Source files under `src` that may call `useTranslations`, tests excluded. */
function sourceFiles(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) {
			return sourceFiles(path);
		}
		return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)
			? [path]
			: [];
	});
}

describe("client message subset", () => {
	it("lists only declared namespaces", () => {
		for (const namespace of CLIENT_NAMESPACES) {
			expect(NAMESPACES).toContain(namespace);
		}
	});

	it("covers exactly the namespaces client components translate with", () => {
		// `useTranslations` is the hook client components use, so the namespaces
		// it names in the source are the ones the provider must carry. A new
		// client namespace missing from the list would fall back to English or
		// the raw key in the browser; a listed one nobody reads would ship dead
		// strings.
		const used = new Set<string>();
		for (const file of sourceFiles(join(import.meta.dir, "..", ".."))) {
			const text = readFileSync(file, "utf8");
			for (const match of text.matchAll(/useTranslations\("(\w+)"\)/g)) {
				used.add(match[1] as string);
			}
		}
		expect([...used].sort()).toEqual([...CLIENT_NAMESPACES].sort());
	});

	it("drops every namespace only the server renders", async () => {
		const full = await loadMessages("en");
		const picked = pickClientMessages(full);
		expect(Object.keys(picked).sort()).toEqual(
			[...CLIENT_NAMESPACES].sort(),
		);
		for (const namespace of NAMESPACES) {
			if (!(CLIENT_NAMESPACES as readonly string[]).includes(namespace)) {
				expect(picked).not.toHaveProperty(namespace);
			}
		}
		// The client namespaces keep their strings untouched.
		expect(picked.queue).toEqual(full.queue);
	});
});
