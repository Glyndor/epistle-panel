import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { stubFetchJson, stubFetchReject } from "@/lib/api/test-support/fetch";
import {
	mockRequestCookies,
	RedirectSignal,
} from "@/lib/auth/test-support/cookies";

mock.module("next-intl/server", () => ({
	getTranslations: async () => (key: string) => key,
}));

const cookies = mockRequestCookies();

const { default: AccountsPage } = await import("./page");

beforeEach(async () => {
	cookies.reset();
	await cookies.signIn();
});
afterEach(cleanup);

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

		render(await AccountsPage());

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

		render(await AccountsPage());

		expect(screen.getByRole("table")).toBeInTheDocument();
		expect(
			screen.getAllByRole("columnheader").map((cell) => cell.textContent),
		).toEqual(["name", "addresses"]);
		// One header row and one row per account.
		expect(screen.getAllByRole("row")).toHaveLength(3);
	});

	it("shows the empty state when there are no accounts", async () => {
		stubFetchJson({ accounts: [] });

		render(await AccountsPage());

		expect(screen.getByText("empty")).toBeInTheDocument();
	});

	it("shows the unreachable notice when the API errors", async () => {
		stubFetchReject();

		render(await AccountsPage());

		expect(screen.getByRole("alert")).toHaveTextContent("unreachable");
	});

	it("redirects to the login page without a session and never calls the API", async () => {
		cookies.reset();
		stubFetchJson({});
		const before = globalThis.fetch;

		const outcome = await (async () => await AccountsPage())().catch(
			(error) => error,
		);

		expect(outcome).toBeInstanceOf(RedirectSignal);
		expect(outcome.target).toBe("/login");
		expect(
			(before as unknown as { mock: { calls: unknown[] } }).mock.calls,
		).toHaveLength(0);
	});
});
