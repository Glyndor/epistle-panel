import { afterEach, expect, it } from "bun:test";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	within,
} from "@testing-library/react";

import { TEST_ADMIN_ID } from "@/lib/config/test-support/admin-id";
import { withAdminRoutes } from "@/test/admin-routes";
import { resetIntl } from "@/test/next-intl";

import { AccountRowActions } from ".";

afterEach(() => {
	cleanup();
	resetIntl();
});

it.each([true, false])(
	"keeps labeled icons and separates delete only for a dynamic account (%s)",
	async (dynamic) => {
		render(
			withAdminRoutes(
				<main id="main-content">
					<AccountRowActions
						row={{
							name: "alice",
							displayName: null,
							dynamic,
							addresses: [],
						}}
					/>
				</main>,
			),
		);
		fireEvent.keyDown(screen.getByRole("button", { name: "actionsFor" }), {
			key: "Enter",
		});
		const menu = await screen.findByRole("menu");
		const actions = within(menu).getAllByRole("menuitem");
		expect(actions.map((item) => item.textContent)).toEqual(
			dynamic ? ["open", "delete"] : ["open"],
		);
		for (const item of actions) {
			const icons = item.querySelectorAll("svg");
			expect(icons).toHaveLength(1);
			expect(icons[0]).toHaveAttribute("aria-hidden", "true");
		}
		expect(
			within(menu).getByRole("menuitem", { name: "open" }),
		).toHaveAttribute("href", `/app/${TEST_ADMIN_ID}/accounts/alice`);
		if (dynamic) {
			const destructive = within(menu).getByRole("menuitem", {
				name: "delete",
			});
			expect(destructive).toHaveAttribute("data-variant", "destructive");
			const separator = within(menu).getByRole("separator");
			expect(destructive.previousElementSibling).toBe(separator);
			expect(separator.previousElementSibling).toBe(actions[0] ?? null);
		} else {
			expect(within(menu).queryByRole("separator")).toBeNull();
			expect(within(menu).getByText("managedInFile")).toBeInTheDocument();
		}
	},
);
