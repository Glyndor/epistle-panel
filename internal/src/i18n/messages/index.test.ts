import { describe, expect, it } from "bun:test";
import { readdirSync } from "node:fs";
import { join } from "node:path";

import { loadMessages, NAMESPACES } from ".";

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

/** The sorted, de-duplicated `{placeholder}` names a message interpolates. */
function placeholders(message: string): string[] {
	const names = [...message.matchAll(/\{\s*([A-Za-z_]\w*)/g)].map(
		(match) => match[1] as string,
	);
	return [...new Set(names)].sort();
}

function filesOf(locale: string): string[] {
	return readdirSync(join(import.meta.dir, locale)).sort();
}

describe("message catalogs", () => {
	it("declares exactly the namespace files present in each locale", () => {
		// A namespace file nobody lists is never loaded, and a listed one that is
		// missing breaks the merge, so the list and both trees must agree.
		const expected = NAMESPACES.map((name) => `${name}.json`).sort();
		expect(filesOf("en")).toEqual(expected);
		expect(filesOf("es")).toEqual(expected);
	});

	it("es carries exactly the same keys as the English source", async () => {
		// A missing or orphaned translation key fails the build here, so the
		// locales can never silently drift apart.
		const en = await loadMessages("en");
		const es = await loadMessages("es");
		for (const namespace of NAMESPACES) {
			expect([...leaves(es[namespace]).keys()].sort()).toEqual(
				[...leaves(en[namespace]).keys()].sort(),
			);
		}
	});

	it("es uses the same placeholders as the English source", async () => {
		const en = await loadMessages("en");
		const es = await loadMessages("es");
		for (const namespace of NAMESPACES) {
			const translated = leaves(es[namespace]);
			for (const [key, message] of leaves(en[namespace])) {
				expect(placeholders(translated.get(key) ?? "")).toEqual(
					placeholders(message),
				);
			}
		}
	});
});
