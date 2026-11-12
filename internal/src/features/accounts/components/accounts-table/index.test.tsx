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
					addresses: ["bob@example.org", "b@example.org"],
				},
				{ name: "alice", addresses: ["alice@example.org"] },
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
				{ name: "bob", addresses: ["bob@example.org"] },
				{ name: "alice", addresses: ["alice@elsewhere.example"] },
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
});
