import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { useActionEnvironment } from "@/features/account-detail/test-support/action-checks";
import type { AccountRow } from "@/features/accounts/schemas/accounts-view";
import { sentRequests } from "@/lib/api/test-support/fetch";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { TEST_ADMIN_ID } from "@/lib/config/test-support/admin-id";
import { withAdminArea } from "@/test/admin-routes";

const cookies = mockRequestCookies();
const { AccountRowActions } = await import(".");

afterEach(cleanup);

const row = (over: Partial<AccountRow> = {}): AccountRow => ({
	name: "alice",
	displayName: null,
	addresses: ["alice@example.test"],
	dynamic: true,
	...over,
});
const open = async (name = "alice") => {
	fireEvent.keyDown(screen.getByRole("button", { name: "actionsFor" }), {
		key: "Enter",
	});
	await screen.findByRole("menu");
	return name;
};
const setup = (value: AccountRow) =>
	render(
		withAdminArea(
			<main id="main-content">
				<div data-testid="cell">
					<AccountRowActions row={value} />
				</div>
			</main>,
		),
	);

describe("AccountRowActions", () => {
	useActionEnvironment(cookies);

	it("is one named button until opened, compact on a fine pointer and 44 px on a coarse one", () => {
		setup(row());

		const trigger = screen.getByRole("button", { name: "actionsFor" });
		expect(trigger.className).toContain("size-8");
		expect(trigger.className).toContain("pointer-coarse:size-11");
		expect(screen.queryByRole("menu")).toBeNull();
	});

	it("offers to open the account and to delete it when the API manages it", async () => {
		setup(row());
		await open();

		expect(screen.getByRole("menuitem", { name: "open" })).toHaveAttribute(
			"href",
			`/app/${TEST_ADMIN_ID}/accounts/alice`,
		);
		expect(
			screen.getByRole("menuitem", { name: "delete" }),
		).toHaveAttribute("data-variant", "destructive");
	});

	it("renders the menu inside the page's main, not in the table and not on the body", async () => {
		setup(row());
		await open();

		const menu = screen.getByRole("menu");
		expect(document.getElementById("main-content")?.contains(menu)).toBe(
			true,
		);
		// Out of the cell, whose table clips what leaves it.
		expect(screen.getByTestId("cell").contains(menu)).toBe(false);
	});

	it("says an account of the configuration file is managed there, and offers no delete", async () => {
		setup(row({ dynamic: false }));
		await open();

		expect(screen.getByText("managedInFile")).toBeInTheDocument();
		expect(screen.queryByRole("menuitem", { name: "delete" })).toBeNull();
		expect(screen.getByRole("menuitem", { name: "open" })).toBeVisible();
	});

	it("puts a name the pages would not accept in no address and offers no delete", async () => {
		setup(row({ name: "../admin" }));
		await open();

		expect(screen.queryByRole("menuitem")).toBeNull();
		expect(document.querySelector("a")).toBeNull();
	});

	it("opens the confirmation from the delete action, and nothing is deleted yet", async () => {
		setup(row());
		await open();

		fireEvent.click(screen.getByRole("menuitem", { name: "delete" }));

		expect(
			await screen.findByRole("alertdialog", { name: "deleteTitle" }),
		).toBeInTheDocument();
		expect(sentRequests()).toHaveLength(0);
	});
});
