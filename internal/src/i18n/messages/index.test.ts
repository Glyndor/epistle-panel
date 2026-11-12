import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
	CLIENT_NAMESPACES,
	loadMessages,
	NAMESPACES,
	pickClientMessages,
} from ".";

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

/**
 * The sorted, de-duplicated `{placeholder}` names a message interpolates. A name
 * is followed by `}` or by `,` (an ICU argument); the words inside a plural or
 * select arm (`{No rows}`) are text, not placeholders.
 */
function placeholders(message: string): string[] {
	const names = [...message.matchAll(/\{\s*([A-Za-z_]\w*)\s*[,}]/g)].map(
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
