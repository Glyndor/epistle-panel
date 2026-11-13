import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { GET_CHUNK, PAGE_SIZE, SCAN_LIMIT } from "../../schemas/mail-input";
import {
	emailFixture,
	SESSION,
	stubJmap,
	uuid,
} from "../../test-support/jmap-stub";
import { loadMessageList } from ".";

const originalFetch = globalThis.fetch;
const savedEnv = { ...process.env };
beforeEach(() => {
	process.env["EPISTLE_API_URL"] = "http://127.0.0.1:8025";
});
afterEach(() => {
	process.env = { ...savedEnv };
	globalThis.fetch = originalFetch;
});

/** A folder of `count` messages: ids newest first, and an Email/get that answers from `make`. */
function folder(
	count: number,
	make: (index: number, id: string) => Record<string, unknown> = () => ({}),
) {
	const ids = Array.from({ length: count }, () => uuid());
	const byId = new Map(
		ids.map((id, i) => [
			id,
			emailFixture({ id, subject: `m${i}`, ...make(i, id) }),
		]),
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

const base = { box: "INBOX", page: 1, filter: "all", q: "" } as const;

describe("loadMessageList without a filter", () => {
	it("fetches only the page's slice of the folder, in the folder's order", async () => {
		const { ids, answers } = folder(120);
		const seen = stubJmap(answers);

		const view = await loadMessageList(SESSION, { ...base, page: 2 });

		expect(view.items.map((i) => i.id)).toEqual(
			ids.slice(PAGE_SIZE, PAGE_SIZE * 2),
		);
		expect(view).toMatchObject({
			page: 2,
			total: 120,
			hasNext: true,
			partial: false,
		});
		expect(seen[0]?.calls[0]).toEqual([
			"Email/query",
			{ accountId: "admin", filter: { inMailbox: "INBOX" } },
			"q",
		]);
		expect(seen[1]?.calls).toHaveLength(1);
		expect(seen[1]?.calls[0]?.[1]["ids"]).toHaveLength(PAGE_SIZE);
	});

	it("marks the last page, an empty folder and a page past the end", async () => {
		stubJmap(folder(120).answers);
		expect(
			await loadMessageList(SESSION, { ...base, page: 3 }),
		).toMatchObject({ hasNext: false });
		const seen = stubJmap(folder(0).answers);
		const empty = await loadMessageList(SESSION, base);
		expect(empty).toMatchObject({ items: [], total: 0, hasNext: false });
		expect(seen).toHaveLength(1);
	});
});

describe("loadMessageList with a filter or a search", () => {
	it("keeps the unread messages and pages the matches", async () => {
		const { answers } = folder(130, (i) => ({
			keywords: i % 2 === 0 ? {} : { $seen: true },
		}));
		stubJmap(answers);
		const view = await loadMessageList(SESSION, {
			...base,
			filter: "unread",
		});
		expect(view.total).toBe(65);
		expect(view.items).toHaveLength(PAGE_SIZE);
		expect(view.hasNext).toBe(true);
		expect(view.items.every((i) => i.unread)).toBe(true);
	});

	it("keeps flagged messages and messages with an attachment", async () => {
		const { answers } = folder(10, (i) => ({
			keywords: i < 2 ? { $flagged: true } : {},
			hasAttachment: i === 5,
		}));
		stubJmap(answers);
		expect(
			(await loadMessageList(SESSION, { ...base, filter: "flagged" }))
				.total,
		).toBe(2);
		expect(
			(await loadMessageList(SESSION, { ...base, filter: "attachments" }))
				.total,
		).toBe(1);
	});

	it("searches subject, sender, recipients and preview, ignoring case", async () => {
		const { answers } = folder(
			4,
			(i) =>
				[
					{ subject: "Quarterly REPORT" },
					{
						from: [
							{ name: "Report Bot", email: "bot@example.org" },
						],
					},
					{ to: [{ name: null, email: "report@example.org" }] },
					{ preview: "nothing here" },
				][i] ?? {},
		);
		stubJmap(answers);
		const view = await loadMessageList(SESSION, { ...base, q: "report" });
		expect(view.total).toBe(3);
		expect(
			(await loadMessageList(SESSION, { ...base, q: "nowhere" })).total,
		).toBe(0);
	});

	it("reads at most the newest SCAN_LIMIT messages, in chunks the server accepts, and says it was partial", async () => {
		const { answers } = folder(SCAN_LIMIT + 200);
		const seen = stubJmap(answers);
		const view = await loadMessageList(SESSION, {
			...base,
			filter: "unread",
		});
		expect(view.partial).toBe(true);
		expect(view.total).toBe(SCAN_LIMIT);
		const calls = seen[1]?.calls ?? [];
		expect(calls).toHaveLength(2);
		expect(
			calls.every((c) => (c[1]["ids"] as string[]).length <= GET_CHUNK),
		).toBe(true);
	});

	it("is not partial for a folder within the limit", async () => {
		stubJmap(folder(10).answers);
		expect(
			(await loadMessageList(SESSION, { ...base, filter: "unread" }))
				.partial,
		).toBe(false);
	});
});

describe("loadMessageList failures", () => {
	it("fails when the mailbox is refused", async () => {
		stubJmap({
			"Email/query": () => {
				throw new Error("boom");
			},
		});
		expect(
			await loadMessageList(SESSION, base).catch((e) => e),
		).toBeInstanceOf(Error);
	});
});
