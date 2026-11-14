import { describe, expect, it } from "bun:test";

import type { EmailRecord } from "@/features/mail/jmap/responses";
import {
	EMPTY_CONDITIONS,
	type ListConditions,
} from "@/features/mail/schemas/list-conditions-model";

import { matchesConditions } from ".";

const char = (code: number) => String.fromCodePoint(code);
/** `é` as one code point and as `e` with a combining acute accent. */
const COMPOSED = char(0xe9);
const DECOMPOSED = `e${char(0x301)}`;

const EMAIL: EmailRecord = {
	id: "m1",
	receivedAt: "2026-11-10T12:00:00Z",
	subject: "Quarterly REPORT",
	preview: "Numbers for the board",
	from: [{ name: "Ana Pérez", email: "ana@example.com" }],
	to: [
		{ name: null, email: "bel@example.org" },
		{ name: "Carl", email: "carl@example.net" },
	],
	cc: [{ name: "Dora", email: "dora@example.com" }],
	keywords: { $seen: true, Work: true, Old: false },
};

const where = (conditions: Partial<ListConditions>) => ({
	...EMPTY_CONDITIONS,
	...conditions,
});

const matches = (conditions: Partial<ListConditions>, email = EMAIL) =>
	matchesConditions(email, where(conditions));

describe("matchesConditions with no condition", () => {
	it("keeps every message, whatever the order", () => {
		expect(matches({})).toBe(true);
		expect(matches({ order: "largest" })).toBe(true);
		expect(
			matchesConditions(
				{ id: "bare", receivedAt: "not a date" },
				EMPTY_CONDITIONS,
			),
		).toBe(true);
	});
});

describe("matchesConditions: q", () => {
	it("finds the words in the subject, the preview, and the names and addresses of from and to", () => {
		for (const q of [
			"quarterly",
			"BOARD",
			"ana pér",
			"ana@example",
			"bel@",
			"carl",
			"example.net",
		]) {
			expect([q, matches({ q })]).toEqual([q, true]);
		}
	});

	it("does not look in cc, in keywords or in the id", () => {
		for (const q of ["dora", "work", "m1"]) {
			expect([q, matches({ q })]).toEqual([q, false]);
		}
	});

	it("does not match words that are split across two fields", () => {
		// The fields are joined by a line break, which a search cannot hold.
		expect(matches({ q: "report numbers" })).toBe(false);
	});

	it("compares without composing, as the list always did", () => {
		const email = { ...EMAIL, subject: `Caf${COMPOSED}` };
		expect(matches({ q: `caf${COMPOSED}` }, email)).toBe(true);
		expect(matches({ q: `caf${DECOMPOSED}` }, email)).toBe(false);
	});
});

describe("matchesConditions: from and to", () => {
	it("finds the text in the name or the address of a sender", () => {
		expect(matches({ from: "PÉREZ" })).toBe(true);
		expect(matches({ from: "@EXAMPLE.com" })).toBe(true);
		expect(matches({ from: "carl" })).toBe(false);
		expect(matches({ from: "numbers" })).toBe(false);
	});

	it("finds the text in any recipient, one without a name included", () => {
		expect(matches({ to: "bel@example" })).toBe(true);
		expect(matches({ to: "carl" })).toBe(true);
		expect(matches({ to: "ana" })).toBe(false);
		expect(matches({ to: "dora" })).toBe(false);
	});

	it("does not join two addresses into one text", () => {
		// The name of one recipient followed by the address of the next.
		expect(matches({ to: "carlbel" })).toBe(false);
		expect(matches({ to: "example.orgcarl" })).toBe(false);
	});

	it("keeps nothing when the field is missing or empty", () => {
		const bare = { id: "bare", receivedAt: EMAIL.receivedAt };
		expect(matches({ from: "a" }, bare)).toBe(false);
		expect(matches({ to: "a" }, { ...bare, to: null })).toBe(false);
		expect(matches({ to: "a" }, { ...bare, to: [] })).toBe(false);
	});

	it("matches a composed and a decomposed letter either way round", () => {
		const composed = {
			...EMAIL,
			from: [{ name: `Jos${COMPOSED}`, email: "j@x.org" }],
			to: [{ name: null, email: `ren${COMPOSED}@x.org` }],
		};
		const decomposed = {
			...EMAIL,
			from: [{ name: `Jos${DECOMPOSED}`, email: "j@x.org" }],
			to: [{ name: null, email: `ren${DECOMPOSED}@x.org` }],
		};
		for (const [email, needle] of [
			[composed, DECOMPOSED],
			[decomposed, COMPOSED],
		] as const) {
			expect(matches({ from: `JOS${needle}` }, email)).toBe(true);
			expect(matches({ to: `ren${needle}@` }, email)).toBe(true);
		}
	});
});

describe("matchesConditions: subject", () => {
	it("finds the text in the subject only", () => {
		expect(matches({ subject: "quarterly rep" })).toBe(true);
		expect(matches({ subject: "board" })).toBe(false);
		expect(matches({ subject: "ana" })).toBe(false);
	});

	it("keeps nothing when the message has no subject", () => {
		expect(matches({ subject: "a" }, { ...EMAIL, subject: null })).toBe(
			false,
		);
		const { subject: _, ...withoutSubject } = EMAIL;
		expect(matches({ subject: "a" }, withoutSubject)).toBe(false);
	});

	it("matches a composed and a decomposed letter either way round", () => {
		const cases = [
			[`Caf${COMPOSED} meeting`, `CAF${DECOMPOSED}`],
			[`Caf${DECOMPOSED} meeting`, `caf${COMPOSED}`],
		] as const;
		for (const [subject, needle] of cases) {
			expect(matches({ subject: needle }, { ...EMAIL, subject })).toBe(
				true,
			);
		}
	});
});

describe("matchesConditions: label", () => {
	it("keeps a message that holds the keyword, in any case", () => {
		expect(matches({ label: "Work" })).toBe(true);
		expect(matches({ label: "work" })).toBe(true);
		expect(matches({ label: "WORK" })).toBe(true);
	});

	it("drops a message without the keyword, or with it switched off", () => {
		expect(matches({ label: "Home" })).toBe(false);
		expect(matches({ label: "Old" })).toBe(false);
		const { keywords: _, ...withoutKeywords } = EMAIL;
		expect(matches({ label: "Work" }, withoutKeywords)).toBe(false);
	});
});

describe("matchesConditions with several conditions", () => {
	it("keeps a message only when every condition keeps it", () => {
		const all = {
			q: "board",
			from: "ana",
			to: "carl",
			subject: "report",
			after: "2026-11-10",
			before: "2026-11-10",
			label: "work",
		};
		expect(matches(all)).toBe(true);
		for (const [name, miss] of [
			["q", "nothing"],
			["from", "carl"],
			["to", "ana"],
			["subject", "board"],
			["after", "2026-11-11"],
			["before", "2026-11-09"],
			["label", "home"],
		] as const) {
			expect([name, matches({ ...all, [name]: miss })]).toEqual([
				name,
				false,
			]);
		}
	});
});
