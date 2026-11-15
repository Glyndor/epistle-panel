import { afterEach, expect, it } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";

import { domainsKeys } from "@/features/domains/queries/domains-query";
import { withAdminRoutes } from "@/test/admin-routes";
import { resetIntl } from "@/test/next-intl";
import { withQuery } from "@/test/query-wrapper";

import { DomainsTable } from ".";

afterEach(() => {
	cleanup();
	resetIntl();
});

it("keeps the domains identity's accessible text and link behavior with its globe icon", () => {
	const client = new QueryClient({
		defaultOptions: {
			queries: { staleTime: Infinity, gcTime: Infinity, retry: false },
		},
	});
	client.setQueryData(domainsKeys.all, [
		{ name: "example.org", disabled: false },
	]);
	try {
		render(withAdminRoutes(withQuery(<DomainsTable />, client)));

		const cell = screen.getByRole("cell", { name: "example.org" });
		expect(cell.textContent).toBe("example.org");
		expect(cell.querySelector("a")).toBeNull();
		expect(cell.querySelector('[data-glyph="globe"]')).toHaveAttribute(
			"aria-hidden",
			"true",
		);
	} finally {
		cleanup();
		client.clear();
	}
});
