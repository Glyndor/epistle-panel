import { afterEach, expect, it } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";

import { suppressionKeys } from "@/features/suppression/queries/suppression-query";
import { withAdminRoutes } from "@/test/admin-routes";
import { resetIntl } from "@/test/next-intl";
import { withQuery } from "@/test/query-wrapper";

import { SuppressionTable } from ".";

afterEach(() => {
	cleanup();
	resetIntl();
});

it("keeps the suppression identity's accessible text and link behavior with its ban icon", () => {
	const client = new QueryClient({
		defaultOptions: {
			queries: { staleTime: Infinity, gcTime: Infinity, retry: false },
		},
	});
	client.setQueryData(suppressionKeys.page(undefined), {
		entries: [{ address: "blocked@example.org" }],
		nextCursor: null,
	});
	try {
		render(
			withAdminRoutes(
				withQuery(<SuppressionTable after={undefined} />, client),
			),
		);

		const cell = screen.getByRole("cell", { name: "blocked@example.org" });
		expect(cell.textContent).toBe("blocked@example.org");
		expect(cell.querySelector("a")).toBeNull();
		expect(cell.querySelector('[data-glyph="ban"]')).toHaveAttribute(
			"aria-hidden",
			"true",
		);
	} finally {
		cleanup();
		client.clear();
	}
});
