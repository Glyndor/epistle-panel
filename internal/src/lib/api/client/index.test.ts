import { afterEach, describe, expect, it, type Mock } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { REQUEST_TIMEOUT_MS } from "../request";
import {
	sentRequests,
	stubFetchHang,
	stubFetchJson,
	stubFetchReject,
} from "../test-support/fetch";
import {
	EpistleApiError,
	getAccounts,
	getDeliveries,
	getDomains,
	getQueue,
	getStatus,
	getSuppression,
	removeQueueEntry,
	removeSuppression,
	VERIFY_TIMEOUT_MS,
	verifyCredentials,
} from ".";

const ID = "01890a5d-ac96-774b-b9aa-9be4c3bd6b0e";

afterEach(() => {
	process.env["EPISTLE_API_URL"] = "http://127.0.0.1:8025";
	delete process.env["EPISTLE_API_TOKEN_FILE"];
	delete process.env["EPISTLE_API_TOKEN"];
	process.env["EPISTLE_API_TOKEN"] = "test-token";
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
		stubFetchJson({
			accounts: [
				{ name: "a", display_name: null, dynamic: true, addresses: [] },
			],
		});
		expect((await getAccounts()).accounts[0]?.name).toBe("a");
	});

	it("parses a queue page", async () => {
		stubFetchJson({ entries: [], next_cursor: ID });
		const page = await getQueue();
		expect(page.entries).toEqual([]);
		expect(page.next_cursor).toBe(ID);
	});

	it("parses the removal confirmation", async () => {
		stubFetchJson({ removed: ID });
		expect((await removeQueueEntry(ID)).removed).toBe(ID);
	});
});

describe("client requests", () => {
	const BASE = "http://127.0.0.1:8025";
	const status = { version: "1", domains: 0, accounts: 0, queue_size: 0 };

	/** The single request the stub received, after checking there was one. */
	function onlyRequest() {
		const calls = sentRequests();
		expect(calls).toHaveLength(1);
		return calls[0] as ReturnType<typeof sentRequests>[number];
	}

	it("reads the status with GET /api/v1/status", async () => {
		stubFetchJson(status);
		await getStatus();
		const sent = onlyRequest();
		expect([sent.method, sent.url]).toEqual([
			"GET",
			`${BASE}/api/v1/status`,
		]);
		expect(sent.body).toBeUndefined();
	});

	it("reads the domains with GET /api/v1/domains", async () => {
		stubFetchJson({ domains: [] });
		await getDomains();
		const sent = onlyRequest();
		expect([sent.method, sent.url]).toEqual([
			"GET",
			`${BASE}/api/v1/domains`,
		]);
	});

	it("reads the accounts with GET /api/v1/accounts", async () => {
		stubFetchJson({ accounts: [] });
		await getAccounts();
		const sent = onlyRequest();
		expect([sent.method, sent.url]).toEqual([
			"GET",
			`${BASE}/api/v1/accounts`,
		]);
	});

	it("asks for the first queue page with no query string", async () => {
		stubFetchJson({ entries: [] });
		await getQueue();
		const sent = onlyRequest();
		expect([sent.method, sent.url]).toEqual([
			"GET",
			`${BASE}/api/v1/queue`,
		]);
	});

	it("sends the cursor, the limit, or both, as query parameters", async () => {
		const urls: string[] = [];
		for (const params of [
			{ cursor: ID },
			{ limit: 2 },
			{ limit: 2, cursor: ID },
		]) {
			stubFetchJson({ entries: [] });
			await getQueue(params);
			urls.push(onlyRequest().url);
		}
		expect(urls).toEqual([
			`${BASE}/api/v1/queue?cursor=${ID}`,
			`${BASE}/api/v1/queue?limit=2`,
			`${BASE}/api/v1/queue?limit=2&cursor=${ID}`,
		]);
	});

	it("asks for deliveries with no query string, skips absent filters and encodes the rest", async () => {
		const urls: string[] = [];
		for (const params of [
			undefined,
			{ outcome: undefined, since: undefined },
			{ outcome: "failed", limit: 100 },
			{ recipient: "a+b@x.org&limit=1", since: "24h" },
		]) {
			stubFetchJson({ entries: [] });
			await getDeliveries(params);
			const sent = onlyRequest();
			expect([sent.method, sent.body]).toEqual(["GET", undefined]);
			urls.push(sent.url);
		}
		expect(urls).toEqual([
			`${BASE}/api/v1/deliveries`,
			`${BASE}/api/v1/deliveries`,
			`${BASE}/api/v1/deliveries?outcome=failed&limit=100`,
			`${BASE}/api/v1/deliveries?recipient=a%2Bb%40x.org%26limit%3D1&since=24h`,
		]);
	});

	it("asks for the first suppression page with no query string, and sends after and limit when given", async () => {
		const urls: string[] = [];
		for (const params of [
			undefined,
			{ after: "a@b.org" },
			{ limit: 2 },
			{ limit: 2, after: "a+b@c.org&limit=9" },
		]) {
			stubFetchJson({ addresses: [] });
			await getSuppression(params);
			const sent = onlyRequest();
			expect(sent.method).toBe("GET");
			urls.push(sent.url);
		}
		expect(urls).toEqual([
			`${BASE}/api/v1/suppression`,
			`${BASE}/api/v1/suppression?after=a%40b.org`,
			`${BASE}/api/v1/suppression?limit=2`,
			`${BASE}/api/v1/suppression?limit=2&after=a%2Bb%40c.org%26limit%3D9`,
		]);
	});

	it("removes an address with DELETE /api/v1/suppression/<encoded address> and no body", async () => {
		stubFetchJson({ removed: "bob@example.net" });
		await removeSuppression("bob@example.net");
		const sent = onlyRequest();
		expect([sent.method, sent.url, sent.body]).toEqual([
			"DELETE",
			`${BASE}/api/v1/suppression/bob%40example.net`,
			undefined,
		]);
	});

	it("encodes every character that could change the path or add a parameter", async () => {
		const urls: string[] = [];
		for (const address of [
			"../status@x.org",
			"a/b@x.org",
			"a%2fb@x.org",
			"a?account=other@x.org",
			"a#frag@x.org",
			"a\\b@x.org",
			"ñ用户@例子.广告",
		]) {
			stubFetchJson({ removed: address });
			await removeSuppression(address);
			urls.push(onlyRequest().url.slice(`${BASE}`.length));
		}
		expect(urls).toEqual([
			"/api/v1/suppression/..%2Fstatus%40x.org",
			"/api/v1/suppression/a%2Fb%40x.org",
			"/api/v1/suppression/a%252fb%40x.org",
			"/api/v1/suppression/a%3Faccount%3Dother%40x.org",
			"/api/v1/suppression/a%23frag%40x.org",
			"/api/v1/suppression/a%5Cb%40x.org",
			"/api/v1/suppression/%C3%B1%E7%94%A8%E6%88%B7%40%E4%BE%8B%E5%AD%90.%E5%B9%BF%E5%91%8A",
		]);
		for (const url of urls) {
			expect(url).not.toContain("?");
			expect(url.slice("/api/v1/suppression/".length)).not.toContain("/");
		}
	});

	it("removes an entry with DELETE /api/v1/queue/<id> and no body", async () => {
		stubFetchJson({ removed: ID });
		await removeQueueEntry(ID);
		const sent = onlyRequest();
		expect([sent.method, sent.url]).toEqual([
			"DELETE",
			`${BASE}/api/v1/queue/${ID}`,
		]);
		expect(sent.body).toBeUndefined();
	});

	it("encodes the id into one path segment, whatever it holds", async () => {
		const urls: string[] = [];
		for (const id of ["../status", "a/b", "a?b=c#d", "a b", "%2e%2e"]) {
			stubFetchJson({ removed: ID });
			await removeQueueEntry(id);
			urls.push(onlyRequest().url);
		}
		expect(urls).toEqual([
			`${BASE}/api/v1/queue/..%2Fstatus`,
			`${BASE}/api/v1/queue/a%2Fb`,
			`${BASE}/api/v1/queue/a%3Fb%3Dc%23d`,
			`${BASE}/api/v1/queue/a%20b`,
			`${BASE}/api/v1/queue/%252e%252e`,
		]);
	});

	it("verifies credentials with POST /api/v1/auth/verify and a JSON body", async () => {
		stubFetchJson({ valid: true, admin: true });
		await verifyCredentials("ops", "pw&=1");
		const sent = onlyRequest();
		expect([sent.method, sent.url]).toEqual([
			"POST",
			`${BASE}/api/v1/auth/verify`,
		]);
		expect(sent.headers.get("content-type")).toBe("application/json");
		expect(JSON.parse(sent.body ?? "")).toEqual({
			name: "ops",
			password: "pw&=1",
		});
		expect(sent.url).not.toContain("pw");
	});

	it("keeps the response out of the Next fetch cache on every call", async () => {
		stubFetchJson(status);
		await getStatus();
		expect(onlyRequest().cache).toBe("no-store");
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
		delete process.env["EPISTLE_API_TOKEN"];
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
		return new Headers(init.headers).get("Authorization") ?? undefined;
	}

	function tokenFile(content: string): { path: string; cleanup: () => void } {
		const dir = mkdtempSync(join(tmpdir(), "epistle-token-"));
		const path = join(dir, "token");
		writeFileSync(path, content);
		return { path, cleanup: () => rmSync(dir, { recursive: true }) };
	}

	it("sends the token read from EPISTLE_API_TOKEN_FILE over the plain one", async () => {
		const file = tokenFile("file-token\n");
		process.env["EPISTLE_API_TOKEN_FILE"] = file.path;
		stubFetchJson(status);
		await getStatus();
		file.cleanup();
		expect(bearer()).toBe("Bearer file-token");
	});

	it("makes no request when the token file is unusable", async () => {
		const file = tokenFile("");
		process.env["EPISTLE_API_TOKEN_FILE"] = file.path;
		stubFetchJson(status);
		const error = await getStatus().catch((e) => e);
		file.cleanup();
		expect(error.message).toContain("EPISTLE_API_TOKEN_FILE");
		expect(globalThis.fetch).not.toHaveBeenCalled();
	});
});

describe("client time budgets", () => {
	async function budgetOf(call: () => Promise<unknown>): Promise<number> {
		stubFetchJson({ ok: true });
		const timeout = AbortSignal.timeout;
		const seen: number[] = [];
		AbortSignal.timeout = (ms: number) => {
			seen.push(ms);
			return timeout.call(AbortSignal, ms);
		};
		try {
			await call().catch(() => undefined);
		} finally {
			AbortSignal.timeout = timeout;
		}
		return seen[0] ?? Number.NaN;
	}

	it("gives every read and the queue removal the ordinary budget", async () => {
		for (const call of [
			getStatus,
			getDomains,
			getAccounts,
			() => getQueue(),
			() => removeQueueEntry(ID),
		]) {
			expect(await budgetOf(call)).toBe(REQUEST_TIMEOUT_MS);
		}
	});

	it("gives credential verification a longer budget", async () => {
		expect(await budgetOf(() => verifyCredentials("ops", "pw"))).toBe(
			VERIFY_TIMEOUT_MS,
		);
		expect(VERIFY_TIMEOUT_MS).toBe(30_000);
	});

	it("rejects a call that never gets an answer", async () => {
		stubFetchHang();
		const timeout = AbortSignal.timeout;
		AbortSignal.timeout = () => timeout.call(AbortSignal, 20);
		try {
			const error = await getStatus().catch((e) => e);
			expect(error.name).toBe("EpistleApiTimeoutError");
		} finally {
			AbortSignal.timeout = timeout;
		}
	});
});

describe("client base URL", () => {
	it("makes no request to a metadata address", async () => {
		process.env["EPISTLE_API_URL"] =
			"http://169.254.169.254/latest/meta-data";
		stubFetchJson({ version: "1", domains: 0, accounts: 0, queue_size: 0 });
		const error = await getStatus().catch((e) => e);
		expect(error.message).toContain("EPISTLE_API_URL");
		expect(globalThis.fetch).not.toHaveBeenCalled();
	});

	it("makes no request to a remote host over plain http", async () => {
		process.env["EPISTLE_API_URL"] = "http://api.remoto:8025";
		stubFetchJson({});
		const error = await verifyCredentials("ops", "pw").catch((e) => e);
		expect(error.message).toContain("EPISTLE_API_URL");
		expect(error.message).not.toContain("pw");
		expect(globalThis.fetch).not.toHaveBeenCalled();
	});
});
