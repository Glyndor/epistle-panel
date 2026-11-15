import { afterEach, expect, it } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";

import { deliveriesKeys } from "@/features/deliveries/queries/deliveries-query";
import { withAdminRoutes } from "@/test/admin-routes";
import { resetIntl } from "@/test/next-intl";
import { withQuery } from "@/test/query-wrapper";

import { DeliveriesTable } from ".";

afterEach(() => {
	cleanup();
	resetIntl();
});

it("keeps the deliveries identity's accessible text and link behavior with its inbox icon", () => {
	const client = new QueryClient({
		defaultOptions: {
			queries: { staleTime: Infinity, gcTime: Infinity, retry: false },
		},
	});
	client.setQueryData(deliveriesKeys.list({}), {
		entries: [
			{
				id: "delivery-1",
				time: 1700000000,
				outcome: "delivered",
				recipient: "r@example.org",
				from: "s@example.net",
				account: "alice",
				remote: null,
				reply: null,
				attempt: 1,
			},
			{
				id: "delivery-2",
				time: 1700000001,
				outcome: "delivered",
				recipient: "other@example.org",
				from: "s@example.net",
				account: null,
				remote: null,
				reply: null,
				attempt: 1,
			},
		],
		logDisabled: false,
		full: false,
	});
	try {
		render(
			withAdminRoutes(
				withQuery(<DeliveriesTable filters={{}} />, client),
			),
		);

		const cell = screen.getByRole("cell", { name: "r@example.org" });
		expect(cell.textContent).toBe("r@example.org");
		expect(cell.querySelector("a")).toBeNull();
		expect(cell.querySelector('[data-glyph="inbox"]')).toHaveAttribute(
			"aria-hidden",
			"true",
		);
		const account = screen.getByRole("cell", { name: "alice" });
		expect(account.textContent).toBe("alice");
		expect(account.querySelector('[data-glyph="users"]')).toHaveAttribute(
			"aria-hidden",
			"true",
		);
		expect(account.querySelector("a")).toBeNull();
		const absentRow = screen
			.getByRole("cell", { name: "other@example.org" })
			.closest("tr");
		expect(absentRow).not.toBeNull();
		const absent = within(absentRow as HTMLElement).getAllByRole("cell")[4];
		expect(absent?.textContent).toBe("none");
		expect(absent?.querySelector("[data-glyph], a")).toBeNull();
	} finally {
		cleanup();
		client.clear();
	}
});
