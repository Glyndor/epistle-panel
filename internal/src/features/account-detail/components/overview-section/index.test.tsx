import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import type { AccountRow } from "@/features/accounts/schemas/accounts-view";

import { OverviewSection } from ".";

const account = (over: Partial<AccountRow> = {}): AccountRow => ({
	name: "alice",
	displayName: "Alice",
	addresses: ["alice@example.org", "a@example.org"],
	dynamic: true,
	...over,
});

afterEach(cleanup);

describe("OverviewSection", () => {
	it("shows the addresses and the profile summary of the account", () => {
		render(<OverviewSection account={account()} />);

		expect(
			screen.getByRole("region", { name: "sectionOverview" }),
		).toBeInTheDocument();
		expect(screen.getByText("alice@example.org")).toBeInTheDocument();
		expect(screen.getByText("a@example.org")).toBeInTheDocument();
		expect(screen.getByText("Alice")).toBeInTheDocument();
	});

	it("says when the account has no addresses and no name", () => {
		render(
			<OverviewSection
				account={account({ addresses: [], displayName: null })}
			/>,
		);

		expect(screen.getByText("noAddresses")).toBeInTheDocument();
		expect(screen.getByText("displayNameNone")).toBeInTheDocument();
	});

	it("shows nothing to type in: the overview is not a form", () => {
		render(<OverviewSection account={account()} />);

		expect(screen.queryByRole("textbox")).toBeNull();
		expect(screen.queryByRole("button")).toBeNull();
	});
});
