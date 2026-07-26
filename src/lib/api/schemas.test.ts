import { describe, expect, it } from "bun:test";

import {
	accountsSchema,
	apiErrorSchema,
	domainsSchema,
	queuePageSchema,
	statusSchema,
} from "./schemas";

describe("statusSchema", () => {
	it("parses the documented shape", () => {
		const parsed = statusSchema.parse({
			version: "0.1.0",
			domains: 1,
			accounts: 2,
			queue_size: 0,
		});
		expect(parsed.queue_size).toBe(0);
	});

	it("rejects negative counters", () => {
		expect(() =>
			statusSchema.parse({
				version: "0.1.0",
				domains: -1,
				accounts: 0,
				queue_size: 0,
			}),
		).toThrow();
	});
});

describe("domainsSchema", () => {
	it("parses a domain list", () => {
		expect(
			domainsSchema.parse({ domains: ["example.org"] }).domains,
		).toEqual(["example.org"]);
	});
});

describe("accountsSchema", () => {
	it("parses accounts with addresses", () => {
		const parsed = accountsSchema.parse({
			accounts: [{ name: "alice", addresses: ["alice@example.org"] }],
		});
		expect(parsed.accounts[0]?.name).toBe("alice");
	});

	it("rejects accounts without a name", () => {
		expect(() =>
			accountsSchema.parse({ accounts: [{ addresses: [] }] }),
		).toThrow();
	});
});

describe("queuePageSchema", () => {
	it("parses a page with a cursor", () => {
		const parsed = queuePageSchema.parse({
			entries: [
				{
					id: "01890a5d-ac96-774b-b9aa-9be4c3bd6b0e",
					reverse_path: "sender@example.org",
					recipients: ["rcpt@elsewhere.example"],
				},
			],
			next_cursor: "01890a5d-ac96-774b-b9aa-9be4c3bd6b0f",
		});
		expect(parsed.next_cursor).toBeDefined();
	});

	it("parses the last page without a cursor", () => {
		const parsed = queuePageSchema.parse({ entries: [] });
		expect(parsed.next_cursor).toBeUndefined();
	});

	it("rejects non-UUID entry ids", () => {
		expect(() =>
			queuePageSchema.parse({
				entries: [{ id: "nope", reverse_path: "", recipients: [] }],
			}),
		).toThrow();
	});
});

describe("apiErrorSchema", () => {
	it("parses the standard error shape", () => {
		const parsed = apiErrorSchema.parse({
			error: {
				code: "invalid_input",
				message: "Field must not be empty.",
			},
		});
		expect(parsed.error.code).toBe("invalid_input");
	});
});
