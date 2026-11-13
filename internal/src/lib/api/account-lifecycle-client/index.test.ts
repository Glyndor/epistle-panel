import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { accountNameSchema } from "../schemas";
import { sentRequests, stubFetchJson } from "../test-support/fetch";
import { createAccount, deleteAccount } from ".";

const BASE = "http://127.0.0.1:8025/api/v1/accounts";
const name = accountNameSchema.parse("alice");
const originalFetch = globalThis.fetch;
const removed = {
	removed: "alice",
	mailbox_files: 3,
	masked_addresses: 0,
	app_passwords: 0,
	suppressed_addresses: 0,
	correspondent_addresses: 0,
	queued_messages_discarded: 0,
	queued_messages_left: 2,
	bayes_tokens_removed: 0,
};

beforeEach(() => {
	process.env["EPISTLE_API_URL"] = "http://127.0.0.1:8025";
	process.env["EPISTLE_API_TOKEN"] = "test-token";
});
afterEach(() => {
	globalThis.fetch = originalFetch;
});

function only() {
	const calls = sentRequests();
	expect(calls).toHaveLength(1);
	return calls[0] as ReturnType<typeof sentRequests>[number];
}

describe("createAccount", () => {
	it("posts the account as JSON, the password in the body and nowhere else", async () => {
		stubFetchJson({ created: "alice" });
		const answer = await createAccount({
			name,
			addresses: ["alice@example.test"],
			password: "correct horse battery",
			displayName: "Alice A",
		});

		const sent = only();
		expect(answer).toEqual({ created: "alice" });
		expect([sent.method, sent.url]).toEqual(["POST", BASE]);
		expect(sent.headers.get("content-type")).toBe("application/json");
		expect(JSON.parse(sent.body ?? "")).toEqual({
			name: "alice",
			addresses: ["alice@example.test"],
			password: "correct horse battery",
			display_name: "Alice A",
		});
		expect(sent.url).not.toContain("correct");
		expect([...sent.headers.values()].join(" ")).not.toContain("correct");
	});

	it("leaves an empty display name out of the request", async () => {
		stubFetchJson({ created: "alice" });
		await createAccount({
			name,
			addresses: ["a@example.test"],
			password: "correct horse battery",
			displayName: "",
		});

		expect(JSON.parse(only().body ?? "")).not.toHaveProperty(
			"display_name",
		);
	});

	it("refuses a name that is not an account name before any request", async () => {
		stubFetchJson({ created: "x" });
		for (const hostile of ["../admin", "a/b", "A", "a b", "", "a%2fb"]) {
			await expect(
				createAccount({
					name: hostile as typeof name,
					addresses: ["a@example.test"],
					password: "correct horse battery",
					displayName: "",
				}),
			).rejects.toThrow();
		}
		expect(sentRequests()).toHaveLength(0);
	});
});

describe("deleteAccount", () => {
	it("sends DELETE with the queue choice the API requires, and reads the two queue counters", async () => {
		stubFetchJson(removed);
		const answer = await deleteAccount(name, "drain");

		const sent = only();
		expect([sent.method, sent.url]).toEqual([
			"DELETE",
			`${BASE}/alice?queue=drain`,
		]);
		expect(answer).toEqual({
			removed: "alice",
			queued_messages_discarded: 0,
			queued_messages_left: 2,
		});

		stubFetchJson({ ...removed, queued_messages_discarded: 5 });
		await deleteAccount(name, "discard");
		expect(only().url).toBe(`${BASE}/alice?queue=discard`);
	});

	it("refuses a hostile name or queue value before any request", async () => {
		stubFetchJson(removed);
		for (const hostile of ["..", "a/../b", "alice?queue=discard", "A"]) {
			await expect(
				deleteAccount(hostile as typeof name, "drain"),
			).rejects.toThrow();
		}
		await expect(
			deleteAccount(name, "discard&x=1" as "discard"),
		).rejects.toThrow();
		expect(sentRequests()).toHaveLength(0);
	});
});
