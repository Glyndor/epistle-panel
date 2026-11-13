import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { stubFetchJson, stubFetchReject } from "@/lib/api/test-support/fetch";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { withQuery } from "@/test/query-wrapper";

const originalFetch = globalThis.fetch;
const cookies = mockRequestCookies();
const { AccountsTable } = await import(".");

beforeEach(async () => {
	cookies.reset();
	await cookies.signIn();
});
afterEach(() => {
	cleanup();
	globalThis.fetch = originalFetch;
});

describe("AccountsTable", () => {
	it("lists each account with its addresses, sortable by account only", async () => {
		stubFetchJson({
			accounts: [
				{
					name: "bob",
					display_name: null,
					dynamic: true,
					addresses: ["bob@example.org", "b@example.org"],
				},
				{
					name: "alice",
					display_name: null,
					dynamic: true,
					addresses: ["alice@example.org"],
				},
			],
		});

		render(withQuery(<AccountsTable />));

		expect(await screen.findByText("alice")).toBeInTheDocument();
		expect(
			screen.getByText("bob@example.org, b@example.org"),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /name/ }),
		).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: /addresses/ })).toBeNull();
	});

	it("filters over the addresses as well as the names", async () => {
		stubFetchJson({
			accounts: [
				{
					name: "bob",
					display_name: null,
					dynamic: true,
					addresses: ["bob@example.org"],
				},
				{
					name: "alice",
					display_name: null,
					dynamic: true,
					addresses: ["alice@elsewhere.example"],
				},
			],
		});
		render(withQuery(<AccountsTable />));
		await screen.findByText("alice");

		fireEvent.change(screen.getByRole("searchbox", { name: "filter" }), {
			target: { value: "elsewhere" },
		});

		expect(await screen.findByText("alice")).toBeInTheDocument();
		expect(screen.queryByText("bob")).toBeNull();
	});

	it("shows the unreachable warning when the API cannot be read", async () => {
		stubFetchReject();

		render(withQuery(<AccountsTable />));

		expect(await screen.findByRole("alert")).toHaveClass("bg-warning");
	});

	it("links each account whose name the detail page accepts to that page, and shows any other name as text", async () => {
		stubFetchJson({
			accounts: [
				{
					name: "alice",
					display_name: null,
					dynamic: true,
					addresses: [],
				},
				{
					name: "../odd",
					display_name: null,
					dynamic: false,
					addresses: [],
				},
			],
		});

		render(withQuery(<AccountsTable />));

		expect(
			await screen.findByRole("link", { name: "alice" }),
		).toHaveAttribute("href", "/app/accounts/alice");
		expect(screen.getByText("../odd")).toBeInTheDocument();
		expect(screen.queryByRole("link", { name: "../odd" })).toBeNull();
	});
});
