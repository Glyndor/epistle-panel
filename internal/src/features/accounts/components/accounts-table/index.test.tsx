import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { stubFetchJson, stubFetchReject } from "@/lib/api/test-support/fetch";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { TEST_ADMIN_ID } from "@/lib/config/test-support/admin-id";
import { withAdminArea } from "@/test/admin-routes";

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

		render(withAdminArea(<AccountsTable />));

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
		render(withAdminArea(<AccountsTable />));
		await screen.findByText("alice");

		fireEvent.change(screen.getByRole("searchbox", { name: "filter" }), {
			target: { value: "elsewhere" },
		});

		expect(await screen.findByText("alice")).toBeInTheDocument();
		expect(screen.queryByText("bob")).toBeNull();
	});

	it("shows the unreachable warning when the API cannot be read", async () => {
		stubFetchReject();

		render(withAdminArea(<AccountsTable />));

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

		render(withAdminArea(<AccountsTable />));

		expect(
			await screen.findByRole("link", { name: "alice" }),
		).toHaveAttribute("href", `/app/${TEST_ADMIN_ID}/accounts/alice`);
		expect(screen.getByText("../odd")).toBeInTheDocument();
		expect(screen.queryByRole("link", { name: "../odd" })).toBeNull();
	});

	const account = (name: string, dynamic: boolean) => ({
		name,
		display_name: null,
		dynamic,
		addresses: [`${name}@example.org`],
	});
	const accountNames = () =>
		screen
			.getAllByRole("row")
			.slice(1)
			.map((row) => row.querySelector("td a")?.textContent);

	it("says where each account is defined: through the API or in the configuration file", async () => {
		stubFetchJson({
			accounts: [account("alice", true), account("ops", false)],
		});

		render(withAdminArea(<AccountsTable />));

		await screen.findByText("alice");
		const [, alice, ops] = screen.getAllByRole("row");
		expect(alice).toHaveTextContent("originApi");
		expect(alice).not.toHaveTextContent("originFile");
		expect(ops).toHaveTextContent("originFile");
		expect(ops).not.toHaveTextContent("originApi");
	});

	it("moves the origin under the name while the table is narrow, and into its own column once it is wide", async () => {
		stubFetchJson({ accounts: [account("ops", false)] });

		render(withAdminArea(<AccountsTable />));
		await screen.findByText("ops");

		const [name, , origin] = screen.getAllByRole("cell");
		const [header] = screen
			.getAllByRole("columnheader")
			.filter((cell) => cell.textContent?.includes("origin"));
		// The column, header and cell alike, is there from the `md` container width on.
		expect(origin).toHaveClass("hidden", "@md:table-cell");
		expect(header).toHaveClass("hidden", "@md:table-cell");
		expect(origin).toHaveTextContent("originFile");
		// Below it the same label sits under the name, and leaves when the column comes.
		const stacked = name?.querySelector('[data-slot="badge"]');
		expect(stacked).toHaveTextContent("originFile");
		expect(stacked?.parentElement).toHaveClass("@md:hidden");
		// Under the name the label may wrap and shrink; in its own column it
		// stays on one line.
		expect(stacked).toHaveClass(
			"shrink",
			"whitespace-normal",
			"text-start",
			"rounded-lg",
		);
		// Between words only: its longest word is the floor of the column.
		// One at a time: a negated check of several classes only fails when
		// the element has them all.
		for (const unwanted of [
			"whitespace-nowrap",
			"shrink-0",
			"wrap-anywhere",
			"break-all",
		]) {
			expect(stacked).not.toHaveClass(unwanted);
		}
		expect(origin?.querySelector('[data-slot="badge"]')).toHaveClass(
			"whitespace-nowrap",
		);
		expect(
			screen.getByRole("table").closest(".\\@container"),
		).not.toBeNull();
	});

	it("narrows by where an account is defined, from the Filters menu", async () => {
		stubFetchJson({
			accounts: [
				account("alice", true),
				account("ops", false),
				account("bob", true),
			],
		});
		render(withAdminArea(<AccountsTable />));
		await screen.findByText("alice");

		fireEvent.keyDown(
			await screen.findByRole("button", {
				name: /filters/,
				expanded: false,
			}),
			{ key: "Enter" },
		);
		const group = await screen.findByRole("group", { name: "origin" });
		expect(
			[...group.querySelectorAll('[role="menuitemcheckbox"]')].map(
				(item) => item.textContent,
			),
		).toEqual(["originApi", "originFile"]);

		fireEvent.click(
			screen.getByRole("menuitemcheckbox", { name: "originFile" }),
		);
		expect(accountNames()).toEqual(["ops"]);

		fireEvent.click(
			screen.getByRole("menuitemcheckbox", { name: "originFile" }),
		);
		fireEvent.click(
			screen.getByRole("menuitemcheckbox", { name: "originApi" }),
		);
		expect(accountNames()).toEqual(["alice", "bob"]);
	});

	it("does not match the text filter against the key behind the origin", async () => {
		stubFetchJson({
			accounts: [account("alice", true), account("ops", false)],
		});
		render(withAdminArea(<AccountsTable />));
		await screen.findByText("alice");

		// "file" and "api" are the keys of the origin column, in no name or address.
		fireEvent.change(screen.getByRole("searchbox", { name: "filter" }), {
			target: { value: "file" },
		});

		// No row is left, so the table offers to take the filter off.
		expect(
			await screen.findByRole("button", { name: "clearFilters" }),
		).toBeInTheDocument();
		expect(screen.queryByText("ops")).toBeNull();
	});

	it("shows 25 accounts a page", async () => {
		stubFetchJson({
			accounts: Array.from({ length: 30 }, (_, index) =>
				account(`user-${String(index + 1).padStart(2, "0")}`, true),
			),
		});
		render(withAdminArea(<AccountsTable />));
		await screen.findByText("user-01");

		expect(accountNames()).toHaveLength(25);
		expect(screen.queryByText("user-26")).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "next" }));
		expect(accountNames()).toEqual([
			"user-26",
			"user-27",
			"user-28",
			"user-29",
			"user-30",
		]);
	});

	it("gives the account's link a 44 px target on a coarse pointer, and breaks a long name at a word end first", async () => {
		stubFetchJson({ accounts: [account("alice", true)] });

		render(withAdminArea(<AccountsTable />));

		const link = await screen.findByRole("link", { name: "alice" });
		expect(link).toHaveClass(
			"inline-flex",
			"items-center",
			"pointer-coarse:min-h-11",
			// A short name ("ops") would leave a target 24 px wide.
			"pointer-coarse:min-w-11",
			"wrap-anywhere",
		);
		expect(link).not.toHaveClass("break-all");
		expect(screen.getByText("alice@example.org")).toHaveClass(
			"wrap-anywhere",
		);
	});
});
