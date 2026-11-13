import { describe, expect, it } from "bun:test";

import { queueAges, uuidV7Seconds } from ".";

/** 2027-01-15 08:00:00 UTC. */
const NOW = 1_800_000_000;

/** Version 7 ids whose first 48 bits are a known millisecond. */
const MADE_NOW = "01a3185c-5000-7abc-8def-0123456789ab";
const MADE_30_MIN_AGO = "01a31840-d8c0-7abc-8def-0123456789ab";
const MADE_3_H_AGO = "01a317b7-8480-7abc-9def-0123456789ab";
const MADE_12_H_AGO = "01a315c9-2200-7abc-adef-0123456789ab";
const MADE_3_D_AGO = "01a308e9-3c00-7abc-bdef-0123456789ab";
const MADE_5_S_AHEAD = "01a3185c-6388-7abc-8def-0123456789ab";
const VERSION_4 = "11111111-1111-4111-8111-111111111111";

const message = (id: string, recipients = 1) => ({
	id,
	recipients: Array.from(
		{ length: recipients },
		(_, i) => `r${i}@example.net`,
	),
});

describe("uuidV7Seconds", () => {
	it("reads the second a version 7 id was made", () => {
		expect(uuidV7Seconds(MADE_NOW)).toBe(1_800_000_000);
		expect(uuidV7Seconds(MADE_30_MIN_AGO)).toBe(1_799_998_200);
		expect(uuidV7Seconds(MADE_3_D_AGO)).toBe(1_799_740_800);
	});

	it("reads an id written in upper case", () => {
		expect(uuidV7Seconds(MADE_NOW.toUpperCase())).toBe(1_800_000_000);
	});

	it("reads no time from an id of another version", () => {
		expect(uuidV7Seconds(VERSION_4)).toBeNull();
		// The same bits with the version digit at 1 and at 8.
		expect(
			uuidV7Seconds("01a3185c-5000-1abc-8def-0123456789ab"),
		).toBeNull();
		expect(
			uuidV7Seconds("01a3185c-5000-8abc-8def-0123456789ab"),
		).toBeNull();
	});

	it("reads no time from text that is not an id", () => {
		for (const text of [
			"",
			"01a3185c-5000-7abc-8def",
			"01a3185c50007abc8def0123456789ab",
			`${MADE_NOW} `,
			"zza3185c-5000-7abc-8def-0123456789ab",
		]) {
			expect(uuidV7Seconds(text)).toBeNull();
		}
	});
});

describe("queueAges", () => {
	it("counts each message under how long it has waited", () => {
		const ages = queueAges(
			[
				message(MADE_30_MIN_AGO),
				message(MADE_NOW),
				message(MADE_3_H_AGO),
				message(MADE_12_H_AGO),
				message(MADE_12_H_AGO),
				message(MADE_3_D_AGO),
				message(MADE_3_D_AGO),
				message(MADE_3_D_AGO),
			],
			NOW,
		);

		expect(ages.messages).toBe(8);
		expect(ages.parts).toEqual([
			{ age: "under1h", count: 2, share: 250 },
			{ age: "under6h", count: 1, share: 125 },
			{ age: "under24h", count: 2, share: 250 },
			{ age: "over24h", count: 3, share: 375 },
		]);
	});

	it("puts a message at the very limit in the longer waiting time", () => {
		const at = (hours: number) =>
			queueAges([message(MADE_NOW)], NOW + hours * 3600).parts.find(
				(part) => part.count === 1,
			)?.age;

		expect(at(1) as string).toBe("under6h");
		expect(at(6) as string).toBe("under24h");
		expect(at(24) as string).toBe("over24h");
	});

	it("keeps a second short of the limit in the shorter one", () => {
		const just = (seconds: number) =>
			queueAges([message(MADE_NOW)], NOW + seconds).parts.find(
				(part) => part.count === 1,
			)?.age;

		expect(just(3599) as string).toBe("under1h");
		expect(just(21_599) as string).toBe("under6h");
		expect(just(86_399) as string).toBe("under24h");
	});

	it("counts an id from a clock a little ahead as just queued", () => {
		expect(queueAges([message(MADE_5_S_AHEAD)], NOW).parts[0]).toEqual({
			age: "under1h",
			count: 1,
			share: 1000,
		});
	});

	it("counts an id with no time apart, and does not guess", () => {
		const ages = queueAges(
			[message(VERSION_4), message(MADE_NOW), message(VERSION_4)],
			NOW,
		);

		expect(ages.parts).toEqual([
			{ age: "under1h", count: 1, share: 333 },
			{ age: "under6h", count: 0, share: 0 },
			{ age: "under24h", count: 0, share: 0 },
			{ age: "over24h", count: 0, share: 0 },
			{ age: "unknown", count: 2, share: 667 },
		]);
	});

	it("leaves the unknown row out when every id has a time", () => {
		const ages = queueAges([message(MADE_NOW)], NOW).parts.map(
			(part) => part.age,
		);

		expect(ages as string[]).toEqual([
			"under1h",
			"under6h",
			"under24h",
			"over24h",
		]);
	});

	it("adds up the recipients still pending", () => {
		const ages = queueAges(
			[
				message(MADE_NOW, 3),
				message(MADE_3_H_AGO, 1),
				message(VERSION_4, 0),
			],
			NOW,
		);

		expect(ages.messages).toBe(3);
		expect(ages.recipients).toBe(4);
	});

	it("is four waiting times at zero for an empty queue", () => {
		const ages = queueAges([], NOW);

		expect(ages.messages).toBe(0);
		expect(ages.recipients).toBe(0);
		expect(ages.parts.map((part) => part.count)).toEqual([0, 0, 0, 0]);
		expect(ages.parts.map((part) => part.share)).toEqual([0, 0, 0, 0]);
	});
});
