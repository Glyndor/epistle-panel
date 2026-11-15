import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { encodeLabelName } from "@/features/mail/labels/name-codec";
import { clearSecretCache } from "@/lib/config/secret";
import { emailFixture, SESSION, stubJmap } from "../../test-support/jmap-stub";
import { labelMessages } from ".";

const originalFetch = globalThis.fetch;
const savedEnv = { ...process.env };
const A = "00000000-0000-4000-8000-0000000000f1";
const B = "00000000-0000-4000-8000-0000000000f2";
const C = "00000000-0000-4000-8000-0000000000f3";

beforeEach(() => {
	clearSecretCache();
	process.env["EPISTLE_API_URL"] = "http://127.0.0.1:8025";
});
afterEach(() => {
	process.env = { ...savedEnv };
	globalThis.fetch = originalFetch;
});

type Update = Record<string, { keywords: Record<string, boolean> }>;

/** A server holding the given messages' keywords; `set` answers the Email/set. */
function serve(
	kept: Record<string, Record<string, boolean>>,
	set: (update: Update) => unknown = (update) => ({
		updated: Object.fromEntries(
			Object.keys(update).map((id) => [id, null]),
		),
	}),
) {
	return stubJmap({
		"Email/get": (args: Record<string, unknown>) => ({
			list: (args["ids"] as string[])
				.filter((id) => id in kept)
				.map((id) => emailFixture({ id, keywords: kept[id] })),
		}),
		"Email/set": (args: Record<string, unknown>) =>
			set(args["update"] as Update),
	});
}
const writes = (seen: ReturnType<typeof stubJmap>) =>
	seen
		.flatMap((r) => r.calls)
		.filter((c) => c[0] === "Email/set")
		.map((c) => c[1]["update"] as Update);

describe("labelMessages", () => {
	it("puts a label on every message in one read and one write, keeping what else each holds", async () => {
		const seen = serve({
			[A]: { $seen: true, Other: true },
			[B]: {},
		});
		const outcome = await labelMessages(SESSION, {
			kind: "keyword",
			ids: [A, B],
			keyword: "Work",
			on: true,
		});
		expect(outcome).toEqual({
			keyword: "Work",
			updated: [A, B],
			failed: [],
		});
		expect(seen.flatMap((r) => r.calls).map((c) => c[0])).toEqual([
			"Email/get",
			"Email/set",
		]);
		expect(writes(seen)).toEqual([
			{
				[A]: { keywords: { $seen: true, Other: true, Work: true } },
				[B]: { keywords: { Work: true } },
			},
		]);
	});

	it("takes a label off in every spelling it is held in and leaves the others", async () => {
		const seen = serve({ [A]: { Work: true, WORK: true, Other: true } });
		await labelMessages(SESSION, {
			kind: "keyword",
			ids: [A],
			keyword: "work",
			on: false,
		});
		expect(writes(seen)).toEqual([{ [A]: { keywords: { Other: true } } }]);
	});

	it("does not write a message that already is as asked", async () => {
		const seen = serve({ [A]: { Work: true }, [B]: {} });
		const on = await labelMessages(SESSION, {
			kind: "keyword",
			ids: [A],
			keyword: "WORK",
			on: true,
		});
		const off = await labelMessages(SESSION, {
			kind: "keyword",
			ids: [B],
			keyword: "Work",
			on: false,
		});
		expect(on.updated).toEqual([A]);
		expect(off.updated).toEqual([B]);
		expect(writes(seen)).toEqual([]);
	});

	it("writes a new label under the keyword of its exact name, and says which", async () => {
		const seen = serve({ [A]: {} });
		const keyword = encodeLabelName("To do") ?? "";
		const outcome = await labelMessages(SESSION, {
			kind: "create",
			ids: [A],
			name: "To do",
		});
		expect(outcome.keyword).toBe(keyword);
		expect(keyword).toStartWith("ep1-");
		expect(writes(seen)).toEqual([
			{ [A]: { keywords: { [keyword]: true } } },
		]);
	});

	it("reports the message the server refused and the one that was not there, and the rest as done", async () => {
		serve({ [A]: {}, [B]: {} }, () => ({
			updated: { [A]: null },
			notUpdated: { [B]: { type: "forbidden" } },
		}));
		const outcome = await labelMessages(SESSION, {
			kind: "keyword",
			ids: [A, B, C],
			keyword: "Work",
			on: true,
		});
		expect(outcome.updated).toEqual([A]);
		expect([...outcome.failed].sort()).toEqual([B, C].sort());
	});

	it("counts a message the answer does not mention as not changed", async () => {
		serve({ [A]: {} }, () => ({ updated: null }));
		const outcome = await labelMessages(SESSION, {
			kind: "keyword",
			ids: [A],
			keyword: "Work",
			on: true,
		});
		expect(outcome).toEqual({ keyword: "Work", updated: [], failed: [A] });
	});

	it("refuses a name the shared rule would not take, without asking the server anything", async () => {
		const seen = serve({ [A]: {} });
		await expect(
			labelMessages(SESSION, {
				kind: "create",
				ids: [A],
				name: "x".repeat(31),
			}),
		).rejects.toThrow("not a label name");
		expect(seen).toHaveLength(0);
	});
});
