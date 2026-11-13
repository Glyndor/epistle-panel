import { describe, expect, it } from "bun:test";

import {
	accountDetailKeys,
	archiveQueryOptions,
	mailboxesQueryOptions,
	maskedQueryOptions,
} from ".";

describe("account queries", () => {
	it("key every query by account and by section, so two accounts never share data", () => {
		expect([...accountDetailKeys.mailboxes("alice")]).toEqual([
			"account",
			"alice",
			"mailboxes",
		]);
		expect([...accountDetailKeys.masked("alice")]).toEqual([
			"account",
			"alice",
			"masked",
		]);
		expect([...accountDetailKeys.archive("alice")]).toEqual([
			"account",
			"alice",
			"archive",
		]);
		expect(accountDetailKeys.masked("alice")).not.toEqual(
			accountDetailKeys.masked("bob"),
		);
	});

	it("use the keys above and the fetcher they were given", async () => {
		const mailboxes = mailboxesQueryOptions("alice", async () => []);
		const masked = maskedQueryOptions("alice", async () => []);
		const archive = archiveQueryOptions("alice", async () => ({
			state: "unavailable",
		}));

		expect([...mailboxes.queryKey]).toEqual([
			...accountDetailKeys.mailboxes("alice"),
		]);
		expect([...masked.queryKey]).toEqual([
			...accountDetailKeys.masked("alice"),
		]);
		expect([...archive.queryKey]).toEqual([
			...accountDetailKeys.archive("alice"),
		]);
		expect(await (archive.queryFn as () => Promise<unknown>)()).toEqual({
			state: "unavailable",
		});
	});
});
