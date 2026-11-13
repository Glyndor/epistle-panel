import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { accountNameSchema, maskedAddressSchema } from "../schemas";
import { sentRequests, stubFetchJson } from "../test-support/fetch";
import {
	createMasked,
	disableTotp,
	enrollTotp,
	getArchive,
	getMailboxes,
	getMasked,
	removeMasked,
	restoreArchived,
	setDisplayName,
	setPassword,
} from ".";

const BASE = "http://127.0.0.1:8025/api/v1/accounts/alice";
const ID = "01890a5d-ac96-774b-b9aa-9be4c3bd6b0e";
const name = accountNameSchema.parse("alice");
const originalFetch = globalThis.fetch;

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

describe("account client", () => {
	it("reads mailboxes, masked addresses and the archive with GET", async () => {
		stubFetchJson({ mailboxes: [], tree: [] });
		await getMailboxes(name);
		expect([only().method, only().url]).toEqual([
			"GET",
			`${BASE}/mailboxes`,
		]);

		stubFetchJson({ addresses: [] });
		await getMasked(name);
		expect(only().url).toBe(`${BASE}/masked`);

		stubFetchJson({ entries: [] });
		await getArchive(name);
		expect(only().url).toBe(`${BASE}/archive`);
	});

	it("sends the password as a JSON body of a PUT, and nowhere else", async () => {
		stubFetchJson({ updated: "alice" });
		await setPassword(name, "correct horse battery");
		const sent = only();
		expect([sent.method, sent.url]).toEqual(["PUT", `${BASE}/password`]);
		expect(sent.headers.get("content-type")).toBe("application/json");
		expect(JSON.parse(sent.body ?? "")).toEqual({
			password: "correct horse battery",
		});
		expect(sent.url).not.toContain("correct");
		expect([...sent.headers.values()].join(" ")).not.toContain("correct");
	});

	it("sets the display name with PUT, empty included", async () => {
		stubFetchJson({ display_name: null });
		await setDisplayName(name, "");
		const sent = only();
		expect([sent.method, sent.url]).toEqual([
			"PUT",
			`${BASE}/display_name`,
		]);
		expect(JSON.parse(sent.body ?? "")).toEqual({ display_name: "" });
	});

	it("enrols with POST and disables with DELETE on the same path, with no body", async () => {
		stubFetchJson({ secret: "S", otpauth_uri: "otpauth://x" });
		await enrollTotp(name);
		expect([only().method, only().url, only().body]).toEqual([
			"POST",
			`${BASE}/totp`,
			undefined,
		]);

		stubFetchJson({ updated: "alice" });
		await disableTotp(name);
		expect([only().method, only().url]).toEqual(["DELETE", `${BASE}/totp`]);
	});

	it("creates a masked address with POST and percent-encodes the address to remove it", async () => {
		stubFetchJson({ address: "news.abcdefgh@example.org" });
		await createMasked(name, "News");
		expect([only().method, only().url]).toEqual(["POST", `${BASE}/masked`]);
		expect(JSON.parse(only().body ?? "")).toEqual({ label: "News" });

		const address = maskedAddressSchema.parse("news.abcdefgh@example.org");
		stubFetchJson({ removed: address });
		await removeMasked(name, address);
		expect([only().method, only().url]).toEqual([
			"DELETE",
			`${BASE}/masked/news.abcdefgh%40example.org`,
		]);
	});

	it("restores an archived message with POST", async () => {
		stubFetchJson({ id: ID, restored_to: "INBOX" });
		await restoreArchived(name, ID);
		expect([only().method, only().url]).toEqual([
			"POST",
			`${BASE}/archive/${ID}/restore`,
		]);
	});

	it("refuses a value that is not an account name before any request, whatever the type says", async () => {
		stubFetchJson({ mailboxes: [], tree: [] });
		for (const hostile of [
			"..",
			"../status",
			"a/b",
			"%2e%2e",
			"Alice",
			"é",
			"a\r\nX: y",
			"",
		]) {
			const forged = hostile as unknown as typeof name;
			await expect(getMailboxes(forged)).rejects.toThrow();
			await expect(setPassword(forged, "x")).rejects.toThrow();
			await expect(enrollTotp(forged)).rejects.toThrow();
			await expect(getArchive(forged)).rejects.toThrow();
		}
		expect(sentRequests()).toHaveLength(0);
	});

	it("refuses a masked address or an archive id that would leave its path", async () => {
		stubFetchJson({ removed: "x" });
		await expect(
			removeMasked(
				name,
				"../status" as unknown as ReturnType<
					typeof maskedAddressSchema.parse
				>,
			),
		).rejects.toThrow();
		await expect(restoreArchived(name, "../status")).rejects.toThrow();
		await expect(restoreArchived(name, `${ID}/../..`)).rejects.toThrow();
		expect(sentRequests()).toHaveLength(0);
	});
});
