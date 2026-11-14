import { afterAll, beforeEach, describe, expect, test } from "bun:test";

import {
	deliveriesSchema,
	queuePageSchema,
	statusSchema,
	suppressionPageSchema,
} from "../../../internal/src/lib/api/schemas";
import { createStandIn } from "./index";
import {
	BUSY_COUNTS,
	buildSample,
	FLOOD_COUNTS,
	FLOOD_QUEUE,
	FLOOD_SUPPRESSED,
	inApiOrder,
	SKEW_HOURS,
	uuidV7,
} from "./sample";

const TOKEN = "stand-in-sample-token";
const { server } = createStandIn({ token: TOKEN });
const base = `http://127.0.0.1:${server.port}`;
const auth = { Authorization: `Bearer ${TOKEN}` };

afterAll(() => server.stop(true));
beforeEach(async () => {
	await fetch(`${base}/__control/reset`, { method: "POST" });
});

const get = async (path: string) =>
	(await fetch(`${base}${path}`, { headers: auth })).json();
const use = (name: string) =>
	fetch(`${base}/__control/sample`, {
		method: "POST",
		body: JSON.stringify({ name }),
	});
const outcomes = async (since: string) => {
	const page = deliveriesSchema.parse(
		await get(`/api/v1/deliveries?since=${since}&limit=100`),
	);
	const counts: Record<string, number> = {};
	for (const entry of page.entries) {
		counts[entry.outcome] = (counts[entry.outcome] ?? 0) + 1;
	}
	return { total: page.entries.length, counts, entries: page.entries };
};

describe("uuidV7", () => {
	test("puts the millisecond it was made in the first 48 bits and 7 as the version", () => {
		// 1 800 000 000 000 ms is 0x01a3185c5000.
		expect(uuidV7(1_800_000_000_000, 0, 1)).toBe(
			"01a3185c-5000-7000-8000-000000000001",
		);
		// Half an hour before.
		expect(uuidV7(1_800_000_000_000, 1800, 12)).toBe(
			"01a31840-d8c0-7000-8000-000000000012",
		);
	});
});

describe("inApiOrder", () => {
	test("lists the newest UTC day first and, inside a day, the oldest record first", () => {
		const day = 86_400;
		const records = [
			{ time: 3 * day + 10 },
			{ time: 5 * day + 500 },
			{ time: 5 * day + 20 },
			{ time: 4 * day + 1 },
			{ time: 5 * day + 86_399 },
		];

		expect(inApiOrder(records).map((record) => record.time)).toEqual([
			5 * day + 20,
			5 * day + 500,
			5 * day + 86_399,
			4 * day + 1,
			3 * day + 10,
		]);
	});
});

describe("buildSample", () => {
	test("skew: every record is inside an hour of the clock, from ten minutes in, at any second of the start", () => {
		for (const started of [1_800_000_000, 1_800_000_059, 1_800_003_599]) {
			const times = (
				buildSample("skew", started * 1000, started)?.deliveries ?? []
			).map((record) => started - record.ageSeconds);

			expect(times).toHaveLength(87);
			for (const time of times) {
				expect(time % 3600).toBeGreaterThanOrEqual(600);
				expect(time % 3600).toBeLessThan(660);
			}
			expect(
				new Set(times.map((time) => Math.floor(time / 3600))).size,
			).toBe(5);
		}
	});

	test("knows busy, quiet, log-off, edge, exact100, flood and skew, and no other name", () => {
		expect(buildSample("busy", 0)).toBeDefined();
		expect(buildSample("exact100", 0)?.deliveries).toHaveLength(100);
		expect(buildSample("flood", 0)?.deliveries).toHaveLength(300);
		expect(buildSample("skew", 0)?.deliveries).toHaveLength(87);
		expect(buildSample("edge", 0)?.queue).toHaveLength(2);
		expect(buildSample("quiet", 0)).toEqual({
			deliveries: [],
			queue: [],
			suppressed: [],
		});
		expect(buildSample("log-off", 0)?.deliveries).toBeNull();
		expect(buildSample("nope", 0)).toBeUndefined();
	});
});

describe("the sample control", () => {
	test("refuses a sample it does not know and changes nothing", async () => {
		const response = await use("nope");

		expect(response.status).toBe(400);
		expect(statusSchema.parse(await get("/api/v1/status")).queue_size).toBe(5);
	});

	test("busy: the log holds the outcomes the checks count, by period", async () => {
		await use("busy");

		const day = await outcomes("24h");
		expect(day.total).toBe(67);
		expect(day.counts).toEqual({ ...BUSY_COUNTS["24h"] });
		expect(day.counts).toEqual({
			delivered: 48,
			deferred: 9,
			failed: 6,
			suppressed: 3,
			canceled: 1,
		});

		const week = await outcomes("7d");
		expect(week.total).toBe(87);
		expect(week.counts).toEqual({
			delivered: 62,
			deferred: 11,
			failed: 9,
			suppressed: 4,
			canceled: 1,
		});
	});

	test("busy: a month is more than a page, cut where the real API cuts it", async () => {
		await use("busy");

		const month = await outcomes("30d");
		expect(month.total).toBe(100);
		// The newest day comes first and, inside a day, the oldest record first.
		const days = month.entries.map((entry) => Math.floor(entry.time / 86_400));
		expect(days).toEqual([...days].sort((a, b) => b - a));
		for (let index = 1; index < month.entries.length; index += 1) {
			const [before, after] = [month.entries[index - 1], month.entries[index]];
			if (before && after && days[index - 1] === days[index]) {
				expect(after.time).toBeGreaterThanOrEqual(before.time);
			}
		}
	});

	test("busy: the queue has ten messages with version 7 ids, oldest first", async () => {
		await use("busy");

		const page = queuePageSchema.parse(await get("/api/v1/queue?limit=100"));
		expect(page.entries).toHaveLength(10);
		expect(page.next_cursor).toBeUndefined();
		expect(page.entries.every((entry) => entry.id[14] === "7")).toBe(true);
		const made = page.entries.map((entry) =>
			Number.parseInt(entry.id.slice(0, 8) + entry.id.slice(9, 13), 16),
		);
		expect(made).toEqual([...made].sort((a, b) => a - b));
		expect(
			page.entries.reduce((sum, entry) => sum + entry.recipients.length, 0),
		).toBe(17);
		expect(statusSchema.parse(await get("/api/v1/status")).queue_size).toBe(10);
	});

	test("busy: the suppression list has fourteen addresses of seven domains", async () => {
		await use("busy");

		const page = suppressionPageSchema.parse(
			await get("/api/v1/suppression?limit=100"),
		);
		expect(page.addresses).toHaveLength(14);
		expect(new Set(page.addresses.map((a) => a.split("@")[1])).size).toBe(7);
		expect(page.addresses).toEqual([...page.addresses].sort());
	});

	test("log-off: the delivery log answers 404, as with a retention of 0 days", async () => {
		await use("log-off");

		const response = await fetch(`${base}/api/v1/deliveries`, { headers: auth });
		expect(response.status).toBe(404);
	});

	test("quiet: nothing in the log, the queue or the list", async () => {
		await use("quiet");

		expect((await outcomes("30d")).total).toBe(0);
		expect(
			queuePageSchema.parse(await get("/api/v1/queue?limit=100")).entries,
		).toHaveLength(0);
		expect(
			suppressionPageSchema.parse(await get("/api/v1/suppression?limit=100"))
				.addresses,
		).toHaveLength(0);
	});

	test("edge: one record, a message with no time in its id and a domain longer than a card", async () => {
		await use("edge");

		expect((await outcomes("24h")).total).toBe(1);
		const queue = queuePageSchema.parse(await get("/api/v1/queue?limit=100"));
		expect(queue.entries.map((entry) => entry.id[14])).toEqual(["7", "4"]);
		const list = suppressionPageSchema.parse(
			await get("/api/v1/suppression?limit=100"),
		);
		expect(list.addresses).toHaveLength(5);
		expect(Math.max(...list.addresses.map((a) => a.length))).toBeGreaterThan(
			180,
		);
	});

	/** Walk a cursor to its end, counting what each page holds. */
	const walk = async (path: string, key: "cursor" | "after") => {
		const pages: number[] = [];
		let next: string | undefined;
		do {
			const body = (await get(
				`${path}?limit=100${next === undefined ? "" : `&${key}=${encodeURIComponent(next)}`}`,
			)) as {
				entries?: unknown[];
				addresses?: unknown[];
				next_cursor?: string;
			};
			pages.push((body.entries ?? body.addresses ?? []).length);
			next = body.next_cursor;
		} while (next !== undefined && pages.length < 20);
		return pages;
	};

	test("exact100: one answer holds the whole log, and the fifth page of the queue and of the list is the last", async () => {
		await use("exact100");

		// Exactly a page, in 24 hours and in 30 days alike: nothing was cut,
		// and nothing in the answer says so.
		expect((await outcomes("24h")).total).toBe(100);
		expect((await outcomes("30d")).total).toBe(100);
		expect((await outcomes("24h")).counts).toEqual({ delivered: 100 });
		// Five full pages and no cursor after the fifth.
		expect(await walk("/api/v1/queue", "cursor")).toEqual([
			100, 100, 100, 100, 100,
		]);
		expect(await walk("/api/v1/suppression", "after")).toEqual([
			100, 100, 100, 100, 100,
		]);
	});

	test("flood: the log, the queue and the list all hold more than is read", async () => {
		await use("flood");

		expect(Object.values(FLOOD_COUNTS).reduce((a, b) => a + b, 0)).toBe(300);
		expect((await outcomes("24h")).total).toBe(100);
		const queue = await walk("/api/v1/queue", "cursor");
		expect(queue.reduce((a, b) => a + b, 0)).toBe(FLOOD_QUEUE);
		expect(queue).toEqual([100, 100, 100, 100, 100, 100, 20]);
		const list = await walk("/api/v1/suppression", "after");
		expect(list.reduce((a, b) => a + b, 0)).toBe(FLOOD_SUPPRESSED);
		expect(list).toEqual([100, 100, 100, 100, 100, 100, 40]);
		expect(statusSchema.parse(await get("/api/v1/status")).queue_size).toBe(
			620,
		);
	});

	test("skew: hours of 60, 5, 12, 2 and 8 records, the hour of 5 with one of each outcome", async () => {
		await use("skew");

		const day = await outcomes("24h");
		expect(day.total).toBe(87);
		expect(day.counts).toEqual({
			delivered: 82,
			deferred: 1,
			failed: 2,
			suppressed: 1,
			canceled: 1,
		});
		// By hour of the UTC clock. The hours are counted back from the newest
		// group, not from now: the stand-in dates its records from its own
		// start, and an hour can turn between that and this line.
		const hourOf = (time: number) => Math.floor(time / 3600);
		const newest = Math.max(...day.entries.map((entry) => hourOf(entry.time)));
		const byHoursAgo = new Map<number, string[]>();
		for (const entry of day.entries) {
			const hoursAgo = newest - hourOf(entry.time) + 3;
			byHoursAgo.set(hoursAgo, [
				...(byHoursAgo.get(hoursAgo) ?? []),
				entry.outcome,
			]);
		}
		expect(
			[...byHoursAgo.entries()]
				.sort((a, b) => a[0] - b[0])
				.map(([hoursAgo, list]) => [hoursAgo, list.length]),
		).toEqual([
			[3, 60],
			[6, 5],
			[9, 12],
			[12, 2],
			[15, 8],
		]);
		// And the newest group is three or four hours of the clock back.
		const back = Math.floor(Date.now() / 3_600_000) - newest;
		expect(back === 3 || back === 4).toBe(true);
		expect([...(byHoursAgo.get(6) ?? [])].sort()).toEqual([
			"canceled",
			"deferred",
			"delivered",
			"failed",
			"suppressed",
		]);
		expect(SKEW_HOURS).toHaveLength(10);
		expect(
			queuePageSchema.parse(await get("/api/v1/queue?limit=100")).entries,
		).toHaveLength(0);
	});

	test("a reset puts the seeds back", async () => {
		await use("busy");
		await fetch(`${base}/__control/reset`, { method: "POST" });

		expect((await outcomes("30d")).total).toBe(5);
		expect(statusSchema.parse(await get("/api/v1/status")).queue_size).toBe(5);
		expect(
			suppressionPageSchema.parse(await get("/api/v1/suppression?limit=100"))
				.addresses,
		).toHaveLength(5);
	});
});
