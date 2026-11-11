import { describe, expect, it } from "bun:test";

import en from "../messages/en.json";
import es from "../messages/es.json";

/** Every dot-namespaced leaf key in a message catalog, sorted. */
function keys(catalog: unknown, prefix = ""): string[] {
	if (typeof catalog !== "object" || catalog === null) {
		return [];
	}
	const out: string[] = [];
	for (const [key, value] of Object.entries(catalog)) {
		const path = prefix ? `${prefix}.${key}` : key;
		if (typeof value === "object" && value !== null) {
			out.push(...keys(value, path));
		} else {
			out.push(path);
		}
	}
	return out.sort();
}

describe("message catalogs", () => {
	it("es carries exactly the same keys as the English source", () => {
		// A missing or orphaned translation key fails the build here, so the
		// locales can never silently drift apart.
		expect(keys(es)).toEqual(keys(en));
	});
});
