import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { clearSecretCache } from "@/lib/config/secret";
import { SESSION, stubJmap } from "../../test-support/jmap-stub";
import { loadSender } from ".";

const originalFetch = globalThis.fetch;
beforeEach(() => {
	clearSecretCache();
	process.env["EPISTLE_API_URL"] = "http://127.0.0.1:8025";
});
afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe("loadSender", () => {
	it("is the first identity, with its name when it has one", async () => {
		stubJmap({
			"Identity/get": {
				list: [
					{ id: "a", name: "Ana", email: "a@x.org" },
					{ id: "b", name: "", email: "b@x.org" },
				],
			},
		});
		expect(await loadSender(SESSION)).toEqual({
			name: "Ana",
			email: "a@x.org",
		});
		stubJmap({
			"Identity/get": { list: [{ id: "b", name: "", email: "b@x.org" }] },
		});
		expect(await loadSender(SESSION)).toEqual({
			name: undefined,
			email: "b@x.org",
		});
	});

	it("is null when the account has no identity", async () => {
		stubJmap({ "Identity/get": { list: [] } });
		expect(await loadSender(SESSION)).toBeNull();
	});
});
