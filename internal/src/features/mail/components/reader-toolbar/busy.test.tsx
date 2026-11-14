import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";

import { clearToasts } from "@/components/ui/toaster";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { clearSecretCache } from "@/lib/config/secret";
import { settled, withQuery } from "@/test/query-wrapper";
import { detail } from "../../test-support/fixtures";
import { emailFixture, stubJmap } from "../../test-support/jmap-stub";

const originalFetch = globalThis.fetch;
const savedEnv = { ...process.env };
const cookies = mockRequestCookies();
const { ReaderToolbar } = await import(".");

const ID = "00000000-0000-4000-8000-0000000000e1";

beforeEach(async () => {
	clearSecretCache();
	cookies.reset();
	clearToasts();
	process.env["EPISTLE_API_URL"] = "http://127.0.0.1:8025";
	process.env["EPISTLE_API_TOKEN"] = "t";
	await cookies.signIn("admin");
});
afterEach(async () => {
	await settled();
	cleanup();
	clearToasts();
	process.env = { ...savedEnv };
	globalThis.fetch = originalFetch;
});

/** A server that keeps the message's keywords, and answers only once `release` is called. */
function slowServer() {
	let kept: Record<string, boolean> = { $seen: true };
	const seen = stubJmap({
		"Email/get": () => ({
			list: [
				emailFixture({
					id: ID,
					keywords: kept,
					mailboxIds: { INBOX: true },
				}),
			],
		}),
		"Mailbox/get": {
			list: [
				{
					id: "INBOX",
					role: "inbox",
					name: "INBOX",
					totalEmails: 1,
					unreadEmails: 0,
				},
				{
					id: "Archive",
					role: "archive",
					name: "Archive",
					totalEmails: 0,
					unreadEmails: 0,
				},
			],
		},
		"Email/set": (args: Record<string, unknown>) => {
			const update = args["update"] as Record<
				string,
				{ keywords?: Record<string, boolean> }
			>;
			kept = update[ID]?.keywords ?? kept;
			return { updated: { [ID]: null } };
		},
	});
	let release = () => {};
	const held = new Promise<void>((resolve) => {
		release = resolve;
	});
	const answer = globalThis.fetch;
	globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
		await held;
		return answer(...args);
	}) as typeof fetch;
	return {
		release: () => release(),
		written: () =>
			seen
				.flatMap((request) => request.calls)
				.filter((call) => call[0] === "Email/set")
				.map((call) => {
					const update = call[1]["update"] as Record<
						string,
						{ keywords?: Record<string, boolean> }
					>;
					return Object.keys(update[ID]?.keywords ?? {}).sort();
				}),
	};
}

function bar() {
	return render(
		withQuery(
			<ReaderToolbar
				message={detail({ id: ID, mailboxId: "INBOX" })}
				onLeft={() => {}}
				inTrash={false}
				inDrafts={false}
			/>,
		),
	);
}
const button = (name: string) => screen.getByRole("button", { name });

describe("ReaderToolbar while a change is on its way", () => {
	it("takes a second flag while the first waits, and writes both, the second on the first", async () => {
		const server = slowServer();
		bar();

		fireEvent.click(button("markUnread"));
		await waitFor(() =>
			expect(button("star")).toHaveAttribute("aria-busy", "true"),
		);
		// Busy, and still open to a press: a shut button dropped the second.
		for (const name of ["star", "markUnread"]) {
			expect(button(name)).toBeEnabled();
			expect(button(name)).toHaveAttribute("aria-busy", "true");
		}
		fireEvent.click(button("star"));
		server.release();

		await waitFor(() => expect(server.written()).toHaveLength(2));
		expect(server.written()).toEqual([[], ["$flagged"]]);
		await settled();
		await waitFor(() =>
			expect(button("star")).not.toHaveAttribute("aria-busy"),
		);
	});

	it("says busy on its two flags the way a row's marks do: cursor and a dot, nothing that moves", () => {
		slowServer().release();
		bar();

		for (const name of ["star", "markUnread"]) {
			expect(button(name)).toHaveClass(
				"relative",
				"aria-busy:cursor-progress",
				"aria-busy:after:absolute",
				"aria-busy:after:size-1.5",
			);
			expect(button(name)).not.toHaveAttribute("aria-busy");
		}
		// The moves have no such mark: they shut the bar instead.
		expect(button("archive")).not.toHaveClass("aria-busy:cursor-progress");
	});

	it("shuts the moves while a flag waits, and everything while a move does", async () => {
		const server = slowServer();
		bar();

		fireEvent.click(button("star"));
		await waitFor(() => expect(button("archive")).toBeDisabled());
		for (const name of ["spam", "trash"]) {
			expect(button(name)).toBeDisabled();
		}
		expect(button("star")).toBeEnabled();
		server.release();
		await waitFor(() => expect(button("archive")).toBeEnabled());
		await settled();
		cleanup();

		const second = slowServer();
		bar();
		fireEvent.click(button("archive"));
		await waitFor(() => expect(button("star")).toBeDisabled());
		expect(button("markUnread")).toBeDisabled();
		expect(button("spam")).toBeDisabled();
		second.release();
		await settled();
	});
});
