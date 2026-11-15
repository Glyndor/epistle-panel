import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { EMPTY_CONDITIONS } from "../../schemas/list-conditions-model";
import {
	emailFixture,
	SESSION,
	stubJmap,
	uuid,
} from "../../test-support/jmap-stub";

const cookies = mockRequestCookies();
const { loadMessageList } = await import(".");

const KEY = "EPISTLE_PANEL_PAGE_SIZE";
const originalFetch = globalThis.fetch;
const savedEnv = { ...process.env };
beforeEach(() => {
	cookies.reset();
	delete process.env[KEY];
	process.env["EPISTLE_API_URL"] = "http://127.0.0.1:8025";
});
afterEach(() => {
	cookies.reset();
	process.env = { ...savedEnv };
	globalThis.fetch = originalFetch;
});

/** A folder of `count` messages, newest first. */
function folder(count: number) {
	const ids = Array.from({ length: count }, () => uuid());
	const byId = new Map(
		ids.map((id, i) => [id, emailFixture({ id, subject: `m${i}` })]),
	);
	return {
		ids,
		answers: {
			"Email/query": { ids },
			"Email/get": (args: Record<string, unknown>) => ({
				list: (args["ids"] as string[]).map((id) => byId.get(id)),
			}),
		},
	};
}

const base = { box: "INBOX", page: 1, conditions: EMPTY_CONDITIONS } as const;

describe("loadMessageList page size", () => {
	it("holds 50 messages a page when nobody chose, as it always did", async () => {
		const { ids, answers } = folder(130);
		stubJmap(answers);

		const view = await loadMessageList(SESSION, base);

		expect(view.items.map((item) => item.id)).toEqual(ids.slice(0, 50));
		expect(view.hasNext).toBe(true);
	});

	it("takes the size from the person's cookie, for the slice, the next page and the fetch", async () => {
		for (const [size, count] of [
			["25", 25],
			["100", 100],
		] as const) {
			cookies.jar.set("page-size", size);
			const { ids, answers } = folder(130);
			const seen = stubJmap(answers);

			const first = await loadMessageList(SESSION, base);
			expect(first.items.map((item) => item.id)).toEqual(
				ids.slice(0, count),
			);
			expect(first.hasNext).toBe(true);
			expect(seen[1]?.calls[0]?.[1]["ids"]).toHaveLength(count);

			stubJmap(answers);
			const second = await loadMessageList(SESSION, { ...base, page: 2 });
			expect(second.items.map((item) => item.id)).toEqual(
				ids.slice(count, count * 2),
			);
		}
	});

	it("marks the last page by the size in force", async () => {
		cookies.jar.set("page-size", "100");
		stubJmap(folder(100).answers);
		expect(await loadMessageList(SESSION, base)).toMatchObject({
			hasNext: false,
		});
		stubJmap(folder(101).answers);
		expect(await loadMessageList(SESSION, base)).toMatchObject({
			hasNext: true,
		});
	});

	it("pages the matches of a filter by the size too", async () => {
		cookies.jar.set("page-size", "25");
		stubJmap(folder(60).answers);

		const view = await loadMessageList(SESSION, {
			...base,
			conditions: { ...EMPTY_CONDITIONS, unread: true },
		});

		expect(view.items).toHaveLength(25);
		expect(view.total).toBe(60);
		expect(view.hasNext).toBe(true);
	});

	it("takes the operator's size over the cookie, and a cookie off the list is 50", async () => {
		cookies.jar.set("page-size", "25");
		process.env[KEY] = "100";
		stubJmap(folder(130).answers);
		expect((await loadMessageList(SESSION, base)).items).toHaveLength(100);

		delete process.env[KEY];
		cookies.jar.set("page-size", "7");
		stubJmap(folder(130).answers);
		expect((await loadMessageList(SESSION, base)).items).toHaveLength(50);
	});
});
