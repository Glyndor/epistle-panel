import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { accountNameSchema } from "@/lib/api/schemas";
import { stubFetchJson } from "@/lib/api/test-support/fetch";

import { loadArchive } from ".";

const ID = "01890a5d-ac96-774b-b9aa-9be4c3bd6b0e";
const name = accountNameSchema.parse("alice");
const originalFetch = globalThis.fetch;
beforeEach(() => {
	process.env["EPISTLE_API_URL"] = "http://127.0.0.1:8025";
	process.env["EPISTLE_API_TOKEN"] = "t";
});
afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe("loadArchive", () => {
	it("lists the archived messages as an available archive", async () => {
		stubFetchJson({
			entries: [{ id: ID, mailbox: "INBOX", deleted_at: 5 }],
		});

		expect(await loadArchive(name)).toEqual({
			state: "available",
			entries: [{ id: ID, mailbox: "INBOX", deletedAt: 5 }],
		});
	});

	it("reads a 404 as an archive that is not available, not as a failure", async () => {
		stubFetchJson(
			{
				error: {
					code: "not_found",
					message: "archive not available: x",
				},
			},
			404,
		);

		expect(await loadArchive(name)).toEqual({ state: "unavailable" });
	});

	it("still reports a server failure", async () => {
		stubFetchJson(
			{ error: { code: "internal", message: "Internal error." } },
			500,
		);

		await expect(loadArchive(name)).rejects.toThrow();
	});
});
