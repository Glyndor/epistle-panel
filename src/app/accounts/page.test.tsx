import { afterEach, describe, expect, it, mock } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { stubFetchJson, stubFetchReject } from "@/lib/api/test-fetch";

mock.module("next-intl/server", () => ({
	getTranslations: async () => (key: string) => key,
}));

const { default: AccountsPage } = await import("./page");

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
});
