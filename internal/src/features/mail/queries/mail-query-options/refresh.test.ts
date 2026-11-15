import { expect, it } from "bun:test";

import { EMPTY_CONDITIONS } from "@/features/mail/schemas/list-conditions-model";
import { mailboxesQueryOptions, messageListQueryOptions } from ".";

const input = { box: "INBOX", page: 1, conditions: EMPTY_CONDITIONS };
const list = async () => ({
	items: [],
	page: 1,
	total: 0,
	hasNext: false,
	partial: false,
	today: "2026-11-15",
});

it("polls the folders and the list at the interval they are given", () => {
	for (const ms of [15_000, 60_000, 90_000]) {
		expect(mailboxesQueryOptions(async () => [], ms).refetchInterval).toBe(
			ms,
		);
		expect(messageListQueryOptions(input, list, ms).refetchInterval).toBe(
			ms,
		);
	}
});
it("polls both at 30 s when it is given no interval", () => {
	expect(mailboxesQueryOptions(async () => []).refetchInterval).toBe(30_000);
	expect(messageListQueryOptions(input, list).refetchInterval).toBe(30_000);
});
it("still polls only while the tab is in view whatever the interval", () => {
	expect(
		mailboxesQueryOptions(async () => [], 60_000)
			.refetchIntervalInBackground,
	).toBe(false);
	expect(
		messageListQueryOptions(input, list, 60_000)
			.refetchIntervalInBackground,
	).toBe(false);
});
