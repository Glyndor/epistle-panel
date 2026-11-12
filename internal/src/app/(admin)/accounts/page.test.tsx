import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import {
	sentRequests,
	stubFetchJson,
	stubFetchReject,
} from "@/lib/api/test-support/fetch";
import {
	mockRequestCookies,
	RedirectSignal,
} from "@/lib/auth/test-support/cookies";

import { withQuery } from "@/test/query-wrapper";

const originalFetch = globalThis.fetch;
const cookies = mockRequestCookies();

const { default: AccountsPage } = await import("./page");

beforeEach(async () => {
	cookies.reset();
	await cookies.signIn();
});
afterEach(() => {
	cleanup();
	globalThis.fetch = originalFetch;
});

describe("AccountsPage", () => {
	it("lists each account with its addresses", async () => {
		stubFetchJson({
			accounts: [
				{
					name: "alice",
					addresses: ["alice@example.org", "a@example.org"],
				},
			],
		});

		render(withQuery(await AccountsPage()));

		expect(screen.getByText("alice")).toBeInTheDocument();
		expect(
			screen.getByText("alice@example.org, a@example.org"),
		).toBeInTheDocument();
	});

	it("puts accounts in a table with a header for each column", async () => {
		stubFetchJson({
			accounts: [
				{ name: "alice", addresses: ["alice@example.org"] },
				{ name: "bob", addresses: [] },
			],
		});

		render(withQuery(await AccountsPage()));

		expect(screen.getByRole("table")).toBeInTheDocument();
		const headers = screen.getAllByRole("columnheader");
		expect(headers).toHaveLength(2);
		expect(headers[0]).toHaveTextContent("name");
		expect(headers[1]).toHaveTextContent("addresses");
		// One header row and one row per account.
		expect(screen.getAllByRole("row")).toHaveLength(3);
	});

	it("shows the empty state when there are no accounts", async () => {
		stubFetchJson({ accounts: [] });

		render(withQuery(await AccountsPage()));

		expect(screen.getByText("empty")).toBeInTheDocument();
	});

	it("shows the unreachable notice when the API errors", async () => {
		stubFetchReject();

		render(withQuery(await AccountsPage()));

		const alert = await screen.findByRole("alert");
		expect(alert).toHaveTextContent("unreachable");
		// An unreachable API is a warning, not a destructive state.
		expect(alert).toHaveClass("bg-warning");
	});

	it("redirects to the login page without a session and never calls the API", async () => {
		cookies.reset();
		stubFetchJson({});

		const outcome = await (async () => await AccountsPage())().catch(
			(error) => error,
		);

		expect(outcome).toBeInstanceOf(RedirectSignal);
		expect(outcome.target).toBe("/login");
		expect(sentRequests()).toHaveLength(0);
	});
});
