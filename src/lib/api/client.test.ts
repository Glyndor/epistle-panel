import { afterEach, describe, expect, it } from "bun:test";

import {
	getAccounts,
	getDomains,
	getQueue,
	getStatus,
	MailApiError,
	removeQueueEntry,
} from "./client";
import { stubFetchJson, stubFetchReject } from "./test-fetch";

const ID = "01890a5d-ac96-774b-b9aa-9be4c3bd6b0e";

afterEach(() => {
	delete process.env.MAIL_API_TOKEN;
	process.env.MAIL_API_TOKEN = "test-token";
});

describe("client getters", () => {
	it("fetches and validates the status", async () => {
		stubFetchJson({
			version: "1.0.0",
			domains: 1,
			accounts: 2,
			queue_size: 0,
		});
		expect((await getStatus()).version).toBe("1.0.0");
	});

	it("fetches domains and accounts", async () => {
		stubFetchJson({ domains: ["example.org"] });
		expect((await getDomains()).domains).toEqual(["example.org"]);
		stubFetchJson({ accounts: [{ name: "a", addresses: [] }] });
		expect((await getAccounts()).accounts[0]?.name).toBe("a");
	});

	it("builds the queue query string and parses the page", async () => {
		stubFetchJson({ entries: [] });
		expect((await getQueue()).entries).toEqual([]);
		stubFetchJson({ entries: [] });
		expect(
			(await getQueue({ limit: 2, cursor: ID })).next_cursor,
		).toBeUndefined();
	});

	it("removes a queue entry", async () => {
		stubFetchJson({ removed: ID });
		expect((await removeQueueEntry(ID)).removed).toBe(ID);
	});
});

describe("client errors", () => {
	it("maps a structured API error to MailApiError", async () => {
		stubFetchJson({ error: { code: "not_found", message: "gone" } }, 404);
		const error = await getStatus().catch((e) => e);
		expect(error).toBeInstanceOf(MailApiError);
		expect(error.code).toBe("not_found");
		expect(error.status).toBe(404);
	});

	it("maps an unrecognized error body to an unknown MailApiError", async () => {
		stubFetchJson({ oops: true }, 500);
		const error = await getStatus().catch((e) => e);
		expect(error).toBeInstanceOf(MailApiError);
		expect(error.code).toBe("unknown");
	});

	it("propagates a network rejection", async () => {
		stubFetchReject();
		expect(getStatus()).rejects.toThrow();
	});

	it("throws when the API token is not configured", async () => {
		delete process.env.MAIL_API_TOKEN;
		stubFetchJson({
			version: "1.0.0",
			domains: 0,
			accounts: 0,
			queue_size: 0,
		});
		expect(getStatus()).rejects.toThrow("MAIL_API_TOKEN");
	});
});
