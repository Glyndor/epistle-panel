import { afterEach, describe, expect, it } from "bun:test";
import type { QueryClient } from "@tanstack/react-query";
import { act, cleanup, renderHook } from "@testing-library/react";
import { renderToString } from "react-dom/server";

import { mailKeys } from "@/features/mail/queries/mail-query-keys";
import { EMPTY_CONDITIONS } from "@/features/mail/schemas/list-conditions-model";
import type {
	MailboxView,
	MessageListView,
} from "@/features/mail/schemas/mail-view";
import { summary } from "@/features/mail/test-support/fixtures";
import { testQueryClient, withQuery } from "@/test/query-wrapper";

import { useLoadedMail } from ".";

afterEach(cleanup);

const list = (...ids: string[]): MessageListView => ({
	items: ids.map((id) => summary({ id })),
	page: 1,
	total: ids.length,
	hasNext: false,
	partial: false,
	today: "2026-11-15",
});

const put = (
	client: QueryClient,
	box: string,
	data: MessageListView,
	updatedAt?: number,
) =>
	client.setQueryData(
		mailKeys.list(box, 1, EMPTY_CONDITIONS),
		data,
		updatedAt === undefined ? undefined : { updatedAt },
	);

const FOLDERS: MailboxView[] = [
	{
		id: "INBOX",
		name: "INBOX",
		role: "inbox",
		parentId: null,
		depth: 0,
		unread: 0,
		total: 0,
	},
];

/** What the probe below read, for the case under way. */
let seen: ReturnType<typeof useLoadedMail> | undefined;

function Probe() {
	seen = useLoadedMail();
	return null;
}

function hook(client: QueryClient) {
	return renderHook(() => useLoadedMail(), {
		wrapper: ({ children }) => <>{withQuery(children, client)}</>,
	});
}

describe("useLoadedMail", () => {
	it("holds nothing while the cache holds nothing", () => {
		const { result } = hook(testQueryClient());

		expect(result.current.pages).toEqual([]);
		expect(result.current.boxes).toBeUndefined();
	});

	it("reads the pages and the folders the cache already holds, the one filled last first", () => {
		const client = testQueryClient();
		put(client, "Old", list("a"), 1000);
		put(client, "New", list("b", "c"), 2000);
		client.setQueryData(mailKeys.mailboxes, FOLDERS);
		const { result } = hook(client);

		expect(
			result.current.pages.map((page) => page.map((m) => m.id)),
		).toEqual([["b", "c"], ["a"]]);
		expect(result.current.boxes).toEqual(FOLDERS);
	});

	it("follows the cache: a page that arrives, is refreshed or is dropped", () => {
		const client = testQueryClient();
		const { result } = hook(client);

		act(() => {
			put(client, "INBOX", list("a"));
		});
		expect(result.current.pages).toHaveLength(1);

		act(() => {
			put(client, "INBOX", list("a", "b"));
		});
		expect(result.current.pages[0]).toHaveLength(2);

		act(() => {
			client.removeQueries({ queryKey: mailKeys.lists });
		});
		expect(result.current.pages).toEqual([]);
	});

	it("follows a flag set in a row, which the cache stamps like any other write", () => {
		const client = testQueryClient();
		put(client, "INBOX", list("a"), 1000);
		const { result } = hook(client);
		expect(result.current.pages[0]?.[0]?.flagged).toBe(false);

		act(() => {
			put(
				client,
				"INBOX",
				{
					...list("a"),
					items: [{ ...summary({ id: "a" }), flagged: true }],
				},
				2000,
			);
		});

		expect(result.current.pages[0]?.[0]?.flagged).toBe(true);
	});

	it("is the same object while what the cache holds is the same", () => {
		const client = testQueryClient();
		put(client, "INBOX", list("a"), 1000);
		const { result, rerender } = hook(client);
		const first = result.current;

		// A message, a query that holds no data and the cache's own noise.
		act(() => {
			client.setQueryData(mailKeys.message("a"), null);
			void client.prefetchQuery({
				queryKey: ["mail", "other"],
				queryFn: () => Promise.reject(new Error("no")),
			});
		});
		rerender();

		expect(result.current).toBe(first);
	});

	it("leaves out a list that holds no data", () => {
		const client = testQueryClient();
		client.getQueryCache().build(client, {
			queryKey: mailKeys.list("INBOX", 1, EMPTY_CONDITIONS),
		});
		const { result } = hook(client);

		expect(result.current.pages).toEqual([]);
	});

	it("draws nothing on the server, whatever the cache holds there", () => {
		const client = testQueryClient();
		put(client, "INBOX", list("a"));
		client.setQueryData(mailKeys.mailboxes, FOLDERS);
		seen = undefined;
		renderToString(withQuery(<Probe />, client));

		const read = seen as ReturnType<typeof useLoadedMail> | undefined;
		expect(read?.pages).toEqual([]);
		expect(read?.boxes).toBeUndefined();
	});
});
