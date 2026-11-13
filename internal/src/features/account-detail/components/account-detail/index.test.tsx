import { afterEach, describe, expect, it, spyOn } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { useActionEnvironment } from "@/features/account-detail/test-support/action-checks";
import { stubRoutes } from "@/features/account-detail/test-support/stub-routes";
import { stubFetchReject } from "@/lib/api/test-support/fetch";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { withQuery } from "@/test/query-wrapper";

const cookies = mockRequestCookies();
const { AccountDetail } = await import(".");

afterEach(cleanup);

const account = (over: object = {}) => ({
	name: "alice",
	display_name: "Alice",
	addresses: ["alice@example.org", "a@example.org"],
	dynamic: true,
	...over,
});
const api = (accounts: unknown[]) =>
	stubRoutes([
		["GET", /\/accounts$/, { body: { accounts } }],
		["GET", /mailboxes$/, { body: { mailboxes: [], tree: [] } }],
		["GET", /masked$/, { body: { addresses: [] } }],
		["GET", /archive$/, { body: { entries: [] } }],
	]);

describe("AccountDetail", () => {
	useActionEnvironment(cookies);

	it("shows the addresses and every section for an account the API manages", async () => {
		api([account(), account({ name: "bob" })]);

		render(withQuery(<AccountDetail name="alice" />));

		expect(
			await screen.findByText("alice@example.org"),
		).toBeInTheDocument();
		expect(screen.getByText("a@example.org")).toBeInTheDocument();
		for (const title of [
			"addresses",
			"profileTitle",
			"passwordTitle",
			"totpTitle",
			"mailboxesTitle",
			"maskedTitle",
			"archiveTitle",
		]) {
			expect(
				screen.getByRole("region", { name: title }),
			).toBeInTheDocument();
		}
		expect(screen.getByRole("link", { name: "back" })).toHaveAttribute(
			"href",
			"/app/accounts",
		);
		expect(screen.queryByText("configManaged")).toBeNull();
	});

	it("leaves out the password and two-factor sections for an account declared in the configuration file", async () => {
		api([account({ dynamic: false, display_name: null })]);

		render(withQuery(<AccountDetail name="alice" />));

		expect(await screen.findByText("configManaged")).toBeInTheDocument();
		expect(
			screen.queryByRole("region", { name: "passwordTitle" }),
		).toBeNull();
		expect(screen.queryByRole("region", { name: "totpTitle" })).toBeNull();
		expect(
			screen.getByRole("region", { name: "maskedTitle" }),
		).toBeInTheDocument();
	});

	it("says there are no addresses", async () => {
		api([account({ addresses: [] })]);

		render(withQuery(<AccountDetail name="alice" />));

		expect(await screen.findByText("noAddresses")).toBeInTheDocument();
	});

	it("says the account is gone when the list no longer has it, with a way back", async () => {
		api([account({ name: "bob" })]);

		render(withQuery(<AccountDetail name="alice" />));

		expect(await screen.findByText("gone")).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "back" })).toBeInTheDocument();
		expect(
			screen.queryByRole("region", { name: "passwordTitle" }),
		).toBeNull();
	});

	it("shows the unreachable notice as a warning when the list cannot be read, and no section", async () => {
		const errors = spyOn(console, "error").mockImplementation(() => {});
		stubFetchReject();

		render(withQuery(<AccountDetail name="alice" />));

		const alert = await screen.findByRole("alert");
		expect(alert).toHaveTextContent("unreachable");
		expect(alert).toHaveClass("bg-warning");
		expect(screen.queryByRole("region")).toBeNull();
		errors.mockRestore();
	});

	it("shows a loading block while the list is on its way", () => {
		api([account()]);

		const { container } = render(withQuery(<AccountDetail name="alice" />));

		expect(container.querySelector("[aria-busy='true']")).not.toBeNull();
	});
});
