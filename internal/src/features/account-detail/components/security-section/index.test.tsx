import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import type { AccountRow } from "@/features/accounts/schemas/accounts-view";

import { SecuritySection } from ".";

const account = (over: Partial<AccountRow> = {}): AccountRow => ({
	name: "alice",
	displayName: "Alice",
	addresses: ["alice@example.org"],
	dynamic: true,
	...over,
});

afterEach(cleanup);

describe("SecuritySection", () => {
	it("shows the password and the two-factor of an account the API manages", () => {
		render(<SecuritySection account={account()} name="alice" />);

		expect(
			screen.getByRole("region", { name: "passwordTitle" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("region", { name: "totpTitle" }),
		).toBeInTheDocument();
	});

	it("says that an account of the configuration file has neither", () => {
		render(
			<SecuritySection
				account={account({ dynamic: false })}
				name="alice"
			/>,
		);

		expect(screen.getByText("configManaged")).toBeInTheDocument();
		expect(
			screen.queryByRole("region", { name: "passwordTitle" }),
		).toBeNull();
		expect(screen.queryByRole("region", { name: "totpTitle" })).toBeNull();
	});
});
