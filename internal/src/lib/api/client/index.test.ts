import { afterEach, describe, expect, it, type Mock } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stubFetchJson, stubFetchReject } from "../test-support/fetch";
import {
	EpistleApiError,
	getAccounts,
	getDomains,
	getQueue,
	getStatus,
	removeQueueEntry,
} from ".";

const ID = "01890a5d-ac96-774b-b9aa-9be4c3bd6b0e";

afterEach(() => {
	delete process.env.EPISTLE_API_TOKEN_FILE;
	delete process.env.EPISTLE_API_TOKEN;
	process.env.EPISTLE_API_TOKEN = "test-token";
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
	it("maps a structured API error to EpistleApiError", async () => {
		stubFetchJson({ error: { code: "not_found", message: "gone" } }, 404);
		const error = await getStatus().catch((e) => e);
		expect(error).toBeInstanceOf(EpistleApiError);
		expect(error.code).toBe("not_found");
		expect(error.status).toBe(404);
	});

	it("maps an unrecognized error body to an unknown EpistleApiError", async () => {
		stubFetchJson({ oops: true }, 500);
		const error = await getStatus().catch((e) => e);
		expect(error).toBeInstanceOf(EpistleApiError);
		expect(error.code).toBe("unknown");
	});

	it("propagates a network rejection", async () => {
		stubFetchReject();
		expect(getStatus()).rejects.toThrow();
	});

	it("throws when the API token is not configured", async () => {
		delete process.env.EPISTLE_API_TOKEN;
		stubFetchJson({
			version: "1.0.0",
			domains: 0,
			accounts: 0,
			queue_size: 0,
		});
		expect(getStatus()).rejects.toThrow("EPISTLE_API_TOKEN");
	});
});

describe("client token file", () => {
	const status = { version: "1.0.0", domains: 0, accounts: 0, queue_size: 0 };

	function bearer(): string | undefined {
		const [, init] = (globalThis.fetch as unknown as Mock<typeof fetch>)
			.mock.calls[0] as [unknown, RequestInit];
		return (init.headers as Record<string, string>).Authorization;
	}

	function tokenFile(content: string): { path: string; cleanup: () => void } {
		const dir = mkdtempSync(join(tmpdir(), "epistle-token-"));
		const path = join(dir, "token");
		writeFileSync(path, content);
		return { path, cleanup: () => rmSync(dir, { recursive: true }) };
	}

	it("sends the token read from EPISTLE_API_TOKEN_FILE over the plain one", async () => {
		const file = tokenFile("file-token\n");
		process.env.EPISTLE_API_TOKEN_FILE = file.path;
		stubFetchJson(status);
		await getStatus();
		file.cleanup();
		expect(bearer()).toBe("Bearer file-token");
	});

	it("makes no request when the token file is unusable", async () => {
		const file = tokenFile("");
		process.env.EPISTLE_API_TOKEN_FILE = file.path;
		stubFetchJson(status);
		const error = await getStatus().catch((e) => e);
		file.cleanup();
		expect(error.message).toContain("EPISTLE_API_TOKEN_FILE");
		expect(globalThis.fetch).not.toHaveBeenCalled();
	});
});
