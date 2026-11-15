import { afterEach, expect, it } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";

import { accountsKeys } from "@/features/accounts/queries/accounts-query";
import { TEST_ADMIN_ID } from "@/lib/config/test-support/admin-id";
import { withAdminRoutes } from "@/test/admin-routes";
import { resetIntl } from "@/test/next-intl";
import { withQuery } from "@/test/query-wrapper";

import { AccountsTable } from ".";

afterEach(() => {
	cleanup();
	resetIntl();
});

it("keeps the accounts identity's accessible text and link behavior with its users icon", () => {
	const client = new QueryClient({
		defaultOptions: {
			queries: { staleTime: Infinity, gcTime: Infinity, retry: false },
		},
	});
	client.setQueryData(accountsKeys.all, [
		{ name: "alice", displayName: null, dynamic: true, addresses: [] },
	]);
	try {
		render(withAdminRoutes(withQuery(<AccountsTable />, client)));

		const cell = screen.getByRole("cell", { name: "alice originApi" });
		const link = screen.getByRole("link", { name: "alice" });
		expect(cell).toContainElement(link);
		expect(link).toHaveAttribute(
			"href",
			`/app/${TEST_ADMIN_ID}/accounts/alice`,
		);
		expect(link.textContent).toBe("alice");
		expect(cell.querySelectorAll("a")).toHaveLength(1);
		expect(cell.querySelector('[data-glyph="users"]')).toHaveAttribute(
			"aria-hidden",
			"true",
		);
	} finally {
		cleanup();
		client.clear();
	}
});
